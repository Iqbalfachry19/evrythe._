import { NextResponse, type NextRequest } from "next/server";
import { findNovelById } from "@/lib/novels-store";
import { getCurrentUser } from "@/lib/auth-server";
import { createOrder } from "@/lib/orders";

type CheckoutPayload = {
  bookId?: string;
  quantity?: number;
};

function getPaypalBaseUrl() {
  return process.env.PAYPAL_BASE_URL ?? "https://api-m.sandbox.paypal.com";
}

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login dulu." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as CheckoutPayload;

    const quantity = Number(body.quantity ?? 1);
    if (!body.bookId || Number.isNaN(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: "Payload tidak valid." },
        { status: 400 },
      );
    }

    const book = await findNovelById(body.bookId);
    if (!book) {
      return NextResponse.json(
        { error: "Buku tidak ditemukan." },
        { status: 404 },
      );
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error:
            "Konfigurasi PayPal belum lengkap. Isi PAYPAL_CLIENT_ID dan PAYPAL_CLIENT_SECRET.",
        },
        { status: 500 },
      );
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );

    const tokenResponse = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return NextResponse.json(
        { error: `Gagal autentikasi PayPal: ${errorText}` },
        { status: 502 },
      );
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const total = (book.priceUsd * quantity).toFixed(2);

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const orderResponse = await fetch(
      `${getPaypalBaseUrl()}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              description: `Pembelian novel: ${book.title}`,
              amount: {
                currency_code: "USD",
                value: total,
              },
            },
          ],
          application_context: {
            return_url: `${origin}/api/checkout/paypal/capture`,
            cancel_url: `${origin}/?checkout=cancel&method=paypal`,
          },
        }),
      },
    );

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      return NextResponse.json(
        { error: `Gagal membuat order PayPal: ${errorText}` },
        { status: 502 },
      );
    }

    const orderData = (await orderResponse.json()) as {
      id: string;
      links?: Array<{ rel: string; href: string }>;
    };

    const approveLink = orderData.links?.find((item) => item.rel === "approve");
    if (!approveLink?.href) {
      return NextResponse.json(
        { error: "Link approval PayPal tidak ditemukan." },
        { status: 502 },
      );
    }

    const order = createOrder({
      userId: user.id,
      bookId: book.id,
      title: book.title,
      quantity,
      paymentMethod: "paypal",
      status: "pending_payment",
      totalUsd: Number(total),
      totalIdr: book.priceIdr * quantity,
      ebookDriveUrl: book.ebookDriveUrl,
      paymentReference: orderData.id,
      checkoutUrl: approveLink.href,
    });

    return NextResponse.json({
      provider: "paypal",
      orderId: orderData.id,
      checkoutUrl: approveLink.href,
      order,
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses pembayaran PayPal." },
      { status: 500 },
    );
  }
}
