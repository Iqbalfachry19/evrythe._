import type { NextRequest } from "next/server";
import { getUserBySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export function getSessionToken(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function getCurrentUser(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  return getUserBySessionToken(token);
}
