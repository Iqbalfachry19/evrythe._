import { NextResponse } from "next/server";
import {
  createSession,
  createUser,
  sanitizeUser,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

type RegisterPayload = {
  name?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterPayload;
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!name || !email || password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Data tidak valid. Isi nama, email, dan password minimal 6 karakter.",
        },
        { status: 400 },
      );
    }

    const user = createUser({ name, email, password });
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal melakukan register.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
