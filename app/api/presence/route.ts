import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { listOnlinePresence, markPresenceOffline, touchPresence } from "../../../lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = getSession(request);
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const online = await listOnlinePresence();
  return NextResponse.json({ count: online.length }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const user = getSession(request);
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  await touchPresence(user);
  const online = await listOnlinePresence();
  return NextResponse.json({ count: online.length }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function DELETE(request: NextRequest) {
  const user = getSession(request);
  if (!user) return NextResponse.json({ ok: true });
  await markPresenceOffline(user);
  return NextResponse.json({ ok: true });
}
