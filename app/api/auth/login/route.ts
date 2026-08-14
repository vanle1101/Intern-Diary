import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, setSession, validateCredentials } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const error = validateCredentials(body?.username, body?.password);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    const user = await authenticateUser(body!.username as string, body!.password as string);
    if (!user) return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." }, { status: 401 });
    const response = NextResponse.json({ user });
    setSession(response, user);
    return response;
  } catch (caught) {
    console.error("Login failed", caught);
    return NextResponse.json({ error: "Không thể đăng nhập lúc này." }, { status: 503 });
  }
}
