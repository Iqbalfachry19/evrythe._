import "server-only";

function getAdminEmailSet() {
  const raw =
    process.env.ADMIN_EMAILS ??
    process.env.ADMIN_EMAIL ??
    "evrythe@gmail.com";

  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string) {
  return getAdminEmailSet().has(email.trim().toLowerCase());
}
