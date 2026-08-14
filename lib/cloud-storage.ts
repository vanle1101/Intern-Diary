import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import type { AppState } from "./models";
import { createInitialState } from "./seed";
import { normalizeState, removeUntouchedDemoData } from "./storage";

const LEGACY_STATE_PATH = "intern-diary/state-v1.json";

function ensureBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN chưa được cấu hình.");
  }
}

function encryptionKey() {
  const secret = process.env.APP_ACCESS_KEY;
  if (!secret) throw new Error("APP_ACCESS_KEY chưa được cấu hình.");
  return createHash("sha256").update(secret).digest();
}

function encryptJson(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
}

function decryptJson<T>(payload: string): T {
  const value = JSON.parse(payload) as { version?: number; iv?: string; tag?: string; data?: string };
  if (value.version !== 1 || !value.iv || !value.tag || !value.data) throw new Error("Dữ liệu mã hoá không hợp lệ.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted) as T;
}

export async function readEncryptedJson<T>(pathname: string): Promise<T | null> {
  ensureBlobToken();
  const found = await list({ prefix: pathname, limit: 10 });
  const blob = found.blobs.find(item => item.pathname === pathname);
  if (!blob) return null;
  const result = await get(blob.url, { access: "public", useCache: false });
  if (!result) throw new Error("Không tìm thấy dữ liệu đã lưu.");
  if (result.statusCode !== 200) throw new Error("Không đọc được bản dữ liệu mới nhất.");
  return decryptJson<T>(await new Response(result.stream).text());
}

export async function writeEncryptedJson(pathname: string, value: unknown, allowOverwrite = true): Promise<void> {
  ensureBlobToken();
  await put(pathname, encryptJson(value), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite,
    contentType: "application/octet-stream",
    cacheControlMaxAge: 0,
  });
}

export async function listEncryptedJson<T>(prefix: string): Promise<Array<{ pathname: string; value: T }>> {
  ensureBlobToken();
  const blobs: Array<{ pathname: string; url: string }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, limit: 1000, cursor });
    blobs.push(...page.blobs.map(blob => ({ pathname: blob.pathname, url: blob.url })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const records = await Promise.all(blobs.map(async blob => {
    try {
      const result = await get(blob.url, { access: "public", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return { pathname: blob.pathname, value: decryptJson<T>(await new Response(result.stream).text()) };
    } catch {
      return null;
    }
  }));
  return records.filter((record): record is { pathname: string; value: T } => record !== null);
}

const userStatePath = (userId: string) => `intern-diary/users/${userId}/state-v1.json`;

export async function readCloudState(userId: string): Promise<AppState> {
  const saved = await readEncryptedJson<Partial<AppState>>(userStatePath(userId));
  if (saved) {
    const normalized = normalizeState(saved);
    const cleaned = removeUntouchedDemoData(normalized);
    if (cleaned) {
      await writeCloudState(userId, cleaned);
      return cleaned;
    }
    return normalized;
  }
  const initial = createInitialState(false);
  await writeCloudState(userId, initial);
  return initial;
}

export async function writeCloudState(userId: string, state: AppState): Promise<void> {
  await writeEncryptedJson(userStatePath(userId), normalizeState(state));
}

export async function readLegacyCloudState(): Promise<AppState | null> {
  const saved = await readEncryptedJson<Partial<AppState>>(LEGACY_STATE_PATH);
  return saved ? normalizeState(saved) : null;
}
