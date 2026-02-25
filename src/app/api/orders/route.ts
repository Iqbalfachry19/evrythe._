import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { listOrdersByUser } from "@/lib/orders";

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Silakan login dulu." },
      { status: 401 },
    );
  }

  const orders = listOrdersByUser(user.id);
  return NextResponse.json({ orders });
}
