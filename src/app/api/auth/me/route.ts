import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/auth-server";
import {
  getUserBySessionToken,
  sanitizeUser,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = getUserBySessionToken(token);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const response = NextResponse.json({ user: sanitizeUser(user) });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
