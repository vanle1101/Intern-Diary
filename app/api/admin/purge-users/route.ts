import { timingSafeEqual } from "node:crypto";
import { del, list, type ListBlobResultBlob } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const expected = process.env.APP_ACCESS_KEY;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function allAppBlobs() {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "intern-diary/", limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Không có quyền." }, { status: 401 });
  const blobs = await allAppBlobs();
  return NextResponse.json({ count: blobs.length, pathnames: blobs.map(blob => blob.pathname) });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Không có quyền." }, { status: 401 });
  const blobs = await allAppBlobs();
  if (blobs.length) await del(blobs.map(blob => blob.url));
  return NextResponse.json({ deleted: blobs.length });
}
