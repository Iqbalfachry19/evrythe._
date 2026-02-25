import { NextResponse, type NextRequest } from "next/server";

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function mapCheckoutStatus(transactionStatus: string | null) {
  if (transactionStatus === "settlement" || transactionStatus === "capture") {
    return "success";
  }

  if (
    transactionStatus === "deny" ||
    transactionStatus === "cancel" ||
    transactionStatus === "expire" ||
    transactionStatus === "failure"
  ) {
    return "failed";
  }

  return "pending";
}

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order_id") ?? "";
  const transactionStatus = request.nextUrl.searchParams.get("transaction_status");

  const redirectUrl = new URL(getAppOrigin());
  redirectUrl.searchParams.set("method", "midtrans");
  redirectUrl.searchParams.set("checkout", mapCheckoutStatus(transactionStatus));

  if (orderId) {
    redirectUrl.searchParams.set("orderId", orderId);
  }

  if (transactionStatus) {
    redirectUrl.searchParams.set("transaction_status", transactionStatus);
  }

  return NextResponse.redirect(redirectUrl);
}
