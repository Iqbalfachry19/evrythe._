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
    throw new Error("Gagal autentikasi PayPal untuk capture.");
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

function getPaypalIssueFromErrorPayload(errorPayload: string) {
  try {
    const parsed = JSON.parse(errorPayload) as {
      details?: Array<{ issue?: string }>;
    };
    return parsed.details?.[0]?.issue ?? null;
  } catch {
    return null;
  }
}

function getPaypalRetryUrlFromErrorPayload(errorPayload: string) {
  try {
    const parsed = JSON.parse(errorPayload) as {
      links?: Array<{ rel?: string; href?: string }>;
    };
    return parsed.links?.find((link) => link.rel === "redirect")?.href ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const orderId =
    request.nextUrl.searchParams.get("token") ??
    request.nextUrl.searchParams.get("orderId");

  if (!orderId) {
    return redirectToResult({
      checkout: "failed",
      method: "paypal",
      reason: "missing_order_id",
    });
  }

  try {
    const accessToken = await getPaypalAccessToken();
    const captureResponse = await fetch(
      `${getPaypalBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!captureResponse.ok) {
      const errorPayload = await captureResponse.text();
      const issue = getPaypalIssueFromErrorPayload(errorPayload);

      if (issue === "ORDER_ALREADY_CAPTURED") {
        updateOrdersPaymentStatus("paypal", orderId, "paid");
        return redirectToResult({
          checkout: "success",
          method: "paypal",
          orderId,
          reason: "already_captured",
        });
      }

      if (issue === "INSTRUMENT_DECLINED") {
        updateOrdersPaymentStatus("paypal", orderId, "pending_payment");
        const retryUrl = getPaypalRetryUrlFromErrorPayload(errorPayload);
        if (retryUrl) {
          updateOrdersCheckoutUrl("paypal", orderId, retryUrl);
          return NextResponse.redirect(retryUrl);
        }
      }

      updateOrdersPaymentStatus("paypal", orderId, "failed");
      console.error("PayPal capture failed", {
        orderId,
        status: captureResponse.status,
        issue,
        errorPayload,
      });
      return redirectToResult({
        checkout: "failed",
        method: "paypal",
        orderId,
        reason: issue ?? `http_${captureResponse.status}`,
      });
    }

    const captureData = (await captureResponse.json()) as {
      status?: string;
    };

    const status =
      captureData.status === "COMPLETED" ? "paid" : "pending_payment";

    updateOrdersPaymentStatus("paypal", orderId, status);

    return redirectToResult({
      checkout: status === "paid" ? "success" : "pending",
      method: "paypal",
      orderId,
    });
  } catch {
    updateOrdersPaymentStatus("paypal", orderId, "failed");
    return redirectToResult({
      checkout: "failed",
      method: "paypal",
      orderId,
    });
  }
}
