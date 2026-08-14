import { NextRequest, NextResponse } from "next/server";
import { registerUser, setSession, validateCredentials, validateFullName } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown; fullName?: unknown } | null;
  const error = validateFullName(body?.fullName) || validateCredentials(body?.username, body?.password);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    const user = await registerUser(body!.username as string, body!.password as string, body!.fullName as string);
    const response = NextResponse.json({ user }, { status: 201 });
    setSession(response, user);
    return response;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Không thể tạo tài khoản.";
    const duplicate = message.includes("đã tồn tại");
    console.error("Registration failed", duplicate ? message : caught);
    return NextResponse.json({ error: duplicate ? message : "Không thể tạo tài khoản lúc này." }, { status: duplicate ? 409 : 503 });
  }
}
