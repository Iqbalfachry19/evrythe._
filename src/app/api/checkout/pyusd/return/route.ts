import { NextResponse, type NextRequest } from "next/server";
import { updateOrdersCheckoutUrl, updateOrdersPaymentStatus } from "@/lib/orders";

function getPaypalBaseUrl() {
  return process.env.PAYPAL_BASE_URL ?? "https://api-m.sandbox.paypal.com";
}

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function getPaypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Konfigurasi PayPal belum lengkap.");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenResponse = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) {
    throw new Error("Gagal autentikasi PayPal.");
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

function redirectToResult(params: Record<string, string>) {
  const redirectUrl = new URL(getAppOrigin());
  Object.entries(params).forEach(([key, value]) => {
    redirectUrl.searchParams.set(key, value);
  });
  return NextResponse.redirect(redirectUrl);
}

function mapPyusdStatus(
  status: string | undefined,
): "pending_payment" | "paid" | "failed" {
  if (status === "COMPLETED") {
    return "paid";
  }
  if (status === "VOIDED" || status === "FAILED" || status === "DECLINED") {
    return "failed";
  }
  return "pending_payment";
}

export async function GET(request: NextRequest) {
  const orderId =
    request.nextUrl.searchParams.get("token") ??
    request.nextUrl.searchParams.get("orderId");

  if (!orderId) {
    return redirectToResult({
      checkout: "failed",
      method: "pyusd",
      reason: "missing_order_id",
    });
  }

  try {
    const accessToken = await getPaypalAccessToken();
    const orderResponse = await fetch(
      `${getPaypalBaseUrl()}/v2/checkout/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!orderResponse.ok) {
      updateOrdersPaymentStatus("pyusd", orderId, "failed");
      return redirectToResult({
        checkout: "failed",
        method: "pyusd",
        orderId,
      });
    }

    const orderData = (await orderResponse.json()) as {
      status?: string;
      links?: Array<{ rel?: string; href?: string }>;
    };
    const nextStatus = mapPyusdStatus(orderData.status);
    updateOrdersPaymentStatus("pyusd", orderId, nextStatus);

    if (nextStatus === "pending_payment") {
      const payerActionLink =
        orderData.links?.find((item) => item.rel === "payer-action")?.href ??
        orderData.links?.find((item) => item.rel === "approve")?.href;
      if (payerActionLink) {
        updateOrdersCheckoutUrl("pyusd", orderId, payerActionLink);
      }
    }

    return redirectToResult({
      checkout: nextStatus === "paid" ? "success" : nextStatus === "failed" ? "failed" : "pending",
      method: "pyusd",
      orderId,
    });
  } catch {
    updateOrdersPaymentStatus("pyusd", orderId, "failed");
    return redirectToResult({
      checkout: "failed",
      method: "pyusd",
      orderId,
    });
  }
}
