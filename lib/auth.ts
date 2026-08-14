import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import { readCloudState, readEncryptedJson, readLegacyCloudState, writeCloudState, writeEncryptedJson } from "./cloud-storage";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "intern_diary_session_v2";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const LEGACY_CLAIM_PATH = "intern-diary/auth/legacy-claimed-v1.json";

export interface PublicUser {
  id: string;
  username: string;
  fullName: string;
}

interface StoredUser extends PublicUser {
  normalizedUsername: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
}

interface SessionPayload extends PublicUser {
  exp: number;
}

function secret() {
  const value = process.env.APP_ACCESS_KEY;
  if (!value) throw new Error("APP_ACCESS_KEY chưa được cấu hình.");
  return value;
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function userPath(username: string) {
  const key = createHash("sha256").update(normalizeUsername(username)).digest("hex");
  return `intern-diary/auth/users/${key}.json`;
}

export function validateCredentials(username: unknown, password: unknown) {
  if (typeof username !== "string" || !/^[A-Za-z0-9._@-]{3,80}$/.test(username.trim())) {
    return "Tên đăng nhập hoặc email phải có 3–80 ký tự, chỉ gồm chữ, số, @, dấu chấm, gạch dưới hoặc gạch ngang.";
  }
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    return "Mật khẩu phải có từ 6 đến 128 ký tự.";
  }
  return null;
}

export function validateFullName(fullName: unknown) {
  if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 80) {
    return "Họ và tên phải có từ 2 đến 80 ký tự.";
  }
  return null;
}

async function hashPassword(password: string, salt: string) {
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return derivedKey.toString("hex");
}

async function findUser(username: string) {
  return readEncryptedJson<StoredUser>(userPath(username));
}

async function provisionState(userId: string, fullName: string) {
  const legacy = await readLegacyCloudState();
  if (legacy) {
    try {
      await writeEncryptedJson(LEGACY_CLAIM_PATH, { userId, claimedAt: new Date().toISOString() }, false);
      await writeCloudState(userId, { ...legacy, profile: { ...legacy.profile, fullName } });
      return;
    } catch {
      // Tài khoản đầu tiên đã nhận dữ liệu cũ; tài khoản này bắt đầu với dữ liệu mẫu riêng.
    }
  }
  const state = await readCloudState(userId);
  await writeCloudState(userId, { ...state, profile: { ...state.profile, fullName } });
}

export async function registerUser(username: string, password: string, fullName: string): Promise<PublicUser> {
  const cleanUsername = username.trim();
  if (await findUser(cleanUsername)) throw new Error("Tên đăng nhập này đã tồn tại.");
  const salt = randomBytes(16).toString("hex");
  const user: StoredUser = {
    id: randomUUID(),
    username: cleanUsername,
    fullName: fullName.trim(),
    normalizedUsername: normalizeUsername(cleanUsername),
    passwordSalt: salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  try {
    await writeEncryptedJson(userPath(cleanUsername), user, false);
  } catch {
    throw new Error("Tên đăng nhập này đã tồn tại.");
  }
  await provisionState(user.id, user.fullName);
  return { id: user.id, username: user.username, fullName: user.fullName };
}

export async function authenticateUser(username: string, password: string): Promise<PublicUser | null> {
  const user = await findUser(username);
  if (!user) return null;
  const supplied = Buffer.from(await hashPassword(password, user.passwordSalt), "hex");
  const expected = Buffer.from(user.passwordHash, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return { id: user.id, username: user.username, fullName: user.fullName };
}

export function createSessionToken(user: PublicUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE } satisfies SessionPayload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function setSession(response: NextResponse, user: PublicUser) {
  response.cookies.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export function getSession(request: NextRequest): PublicUser | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!value.id || !value.username || !value.fullName || value.exp <= Math.floor(Date.now() / 1000)) return null;
    return { id: value.id, username: value.username, fullName: value.fullName };
  } catch {
    return null;
  }
}
