import { NextResponse } from "next/server";
import {
  authenticateUser,
  createSession,
  sanitizeUser,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

type LoginPayload = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginPayload;
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi." },
        { status: 400 },
      );
    }

    const user = authenticateUser(email, password);
    if (!user) {
      return NextResponse.json(
        { error: "Email atau password tidak valid." },
        { status: 401 },
      );
    }

    const session = createSession(user.id);

    const response = NextResponse.json({ user: sanitizeUser(user) });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat login." },
      { status: 500 },
    );
  }
}
