import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminProductsManager from "./AdminProductsManager";
import { isAdminEmail } from "@/lib/admin";
import { getUserBySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  if (!token) {
    redirect("/");
  }

  const user = getUserBySessionToken(token);
  if (!user || !isAdminEmail(user.email)) {
    redirect("/");
  }

  return <AdminProductsManager />;
}
