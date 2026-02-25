import { NextResponse, type NextRequest } from "next/server";
import { invalidateSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSessionToken } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  const token = getSessionToken(request);
  if (token) {
    invalidateSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
