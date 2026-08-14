import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = getSession(request);
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
