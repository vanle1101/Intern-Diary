import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { AppState } from "../../../lib/models";
import { readCloudState, writeCloudState } from "../../../lib/cloud-storage";
import { normalizeState } from "../../../lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const expected = process.env.APP_ACCESS_KEY;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

const headers = { "Cache-Control": "no-store, max-age=0" };
const unauthorized = () => NextResponse.json({ error: "Mã truy cập không đúng." }, { status: 401, headers });

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    return NextResponse.json({ state: await readCloudState() }, { headers });
  } catch (error) {
    console.error("Cloud state read failed", error);
    return NextResponse.json({ error: "Không thể đọc dữ liệu trên Vercel." }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 1_000_000) return NextResponse.json({ error: "Dữ liệu vượt quá giới hạn 1 MB." }, { status: 413, headers });
  try {
    const body = await request.json() as { state?: Partial<AppState> };
    if (!body.state || body.state.version !== 1) {
      return NextResponse.json({ error: "Dữ liệu không đúng định dạng." }, { status: 400, headers });
    }
    await writeCloudState(normalizeState(body.state));
    return NextResponse.json({ savedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    console.error("Cloud state write failed", error);
    return NextResponse.json({ error: "Không thể lưu dữ liệu trên Vercel." }, { status: 503, headers });
  }
}
