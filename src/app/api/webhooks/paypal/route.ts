import { NextResponse } from "next/server";
import { updateOrdersPaymentStatus } from "@/lib/orders";

type PaypalWebhookEvent = {
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
  };
};

function getPaypalBaseUrl() {
  return process.env.PAYPAL_BASE_URL ?? "https://api-m.sandbox.paypal.com";
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
    throw new Error("Gagal mendapatkan access token PayPal.");
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

async function verifyPaypalWebhook(
  event: PaypalWebhookEvent,
  headers: Headers,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID belum dikonfigurasi.");
  }

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false;
  }

  const accessToken = await getPaypalAccessToken();

  const verifyResponse = await fetch(
    `${getPaypalBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: event,
      }),
    },
  );

  if (!verifyResponse.ok) {
    return false;
  }

  const verifyData = (await verifyResponse.json()) as {
    verification_status?: string;
  };

  return verifyData.verification_status === "SUCCESS";
}

function mapPaypalStatus(eventType: string, resourceStatus?: string) {
  if (
    eventType === "PAYMENT.CAPTURE.COMPLETED" ||
    resourceStatus === "COMPLETED"
  ) {
    return "paid" as const;
  }

  if (
    eventType === "PAYMENT.CAPTURE.DENIED" ||
    eventType === "PAYMENT.CAPTURE.DECLINED" ||
    eventType === "PAYMENT.CAPTURE.REFUNDED" ||
    eventType === "CHECKOUT.ORDER.VOIDED" ||
    resourceStatus === "DENIED" ||
    resourceStatus === "FAILED" ||
    resourceStatus === "VOIDED"
  ) {
    return "failed" as const;
  }

  return "pending_payment" as const;
}

function extractPaypalOrderId(event: PaypalWebhookEvent) {
  const fromRelated = event.resource?.supplementary_data?.related_ids?.order_id;
  if (fromRelated) {
    return fromRelated;
  }

  return event.resource?.id;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as PaypalWebhookEvent;
    const eventType = payload.event_type;

    if (!eventType) {
      return NextResponse.json(
        { error: "Payload webhook PayPal tidak valid." },
        { status: 400 },
      );
    }

    const verified = await verifyPaypalWebhook(payload, request.headers);
    if (!verified) {
      return NextResponse.json(
        { error: "Verifikasi webhook PayPal gagal." },
        { status: 401 },
      );
    }

    const paypalOrderId = extractPaypalOrderId(payload);
    if (!paypalOrderId) {
      return NextResponse.json(
        { error: "Order ID tidak ditemukan di payload PayPal." },
        { status: 400 },
      );
    }

    const status = mapPaypalStatus(eventType, payload.resource?.status);

    const orders = updateOrdersPaymentStatus("paypal", paypalOrderId, status);
    if (orders.length === 0) {
      return NextResponse.json(
        { error: "Order tidak ditemukan untuk webhook PayPal." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat memproses webhook PayPal.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
