import { NextRequest, NextResponse } from "next/server";
import { getSession, listRegisteredUsers } from "../../../../lib/auth";
import { listOnlinePresence } from "../../../../lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });

  const [users, online] = await Promise.all([listRegisteredUsers(), listOnlinePresence()]);
  const onlineById = new Map(online.map(record => [record.userId, record.lastSeen]));
  return NextResponse.json({
    users: users.map(user => ({ ...user, online: onlineById.has(user.id), lastSeen: onlineById.get(user.id) ?? null })),
    onlineCount: online.length,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
