import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import type { AppState } from "./models";
import { createInitialState } from "./seed";
import { normalizeState } from "./storage";

const STATE_PATH = "intern-diary/state-v1.json";

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

function encryptState(state: AppState) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(normalizeState(state)), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
}

function decryptState(payload: string) {
  const value = JSON.parse(payload) as { version?: number; iv?: string; tag?: string; data?: string };
  if (value.version !== 1 || !value.iv || !value.tag || !value.data) throw new Error("Dữ liệu mã hoá không hợp lệ.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]).toString("utf8");
  return normalizeState(JSON.parse(decrypted));
}

export async function readCloudState(): Promise<AppState> {
  ensureBlobToken();
  const found = await list({ prefix: STATE_PATH, limit: 1 });
  const blob = found.blobs.find(item => item.pathname === STATE_PATH);
  if (!blob) {
    const initial = createInitialState(true);
    await writeCloudState(initial);
    return initial;
  }
  const result = await get(blob.url, { access: "public", useCache: false });
  if (!result) throw new Error("Không tìm thấy dữ liệu đã lưu.");
  if (result.statusCode !== 200) throw new Error("Không đọc được bản dữ liệu mới nhất.");
  return decryptState(await new Response(result.stream).text());
}

export async function writeCloudState(state: AppState): Promise<void> {
  ensureBlobToken();
  await put(STATE_PATH, encryptState(state), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/octet-stream",
    cacheControlMaxAge: 0,
  });
}
