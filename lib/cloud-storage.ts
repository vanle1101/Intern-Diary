import { get, put } from "@vercel/blob";
import type { AppState } from "./models";
import { createInitialState } from "./seed";
import { normalizeState } from "./storage";

const STATE_PATH = "intern-diary/state-v1.json";

function ensureBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN chưa được cấu hình.");
  }
}

export async function readCloudState(): Promise<AppState> {
  ensureBlobToken();
  const result = await get(STATE_PATH, { access: "private", useCache: false });
  if (!result) {
    const initial = createInitialState(true);
    await writeCloudState(initial);
    return initial;
  }
  if (result.statusCode !== 200) throw new Error("Không đọc được bản dữ liệu mới nhất.");
  return normalizeState(await new Response(result.stream).json());
}

export async function writeCloudState(state: AppState): Promise<void> {
  ensureBlobToken();
  await put(STATE_PATH, JSON.stringify(normalizeState(state)), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 0,
  });
}
