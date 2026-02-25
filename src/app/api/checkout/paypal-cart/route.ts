import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createOrder } from "@/lib/orders";
import { findNovelById } from "@/lib/novels-store";

type CartItemPayload = {
  bookId?: string;
  quantity?: number;
};

type CheckoutPayload = {
  items?: CartItemPayload[];
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
    const items = body.items ?? [];
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Cart kosong." },
        { status: 400 },
      );
    }

    const normalized = items
      .map((item) => ({
        bookId: item.bookId ?? "",
        quantity: Number(item.quantity ?? 0),
      }))
      .filter((item) => item.bookId && Number.isFinite(item.quantity) && item.quantity > 0);

    if (normalized.length === 0) {
      return NextResponse.json(
        { error: "Data cart tidak valid." },
        { status: 400 },
      );
    }

    const cartBooks = (
      await Promise.all(
        normalized.map(async (item) => {
          const book = await findNovelById(item.bookId);
          if (!book) {
            return null;
          }
          return { book, quantity: item.quantity };
        }),
      )
    ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (cartBooks.length !== normalized.length) {
      return NextResponse.json(
        { error: "Ada buku di cart yang tidak ditemukan." },
        { status: 400 },
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
      const errorText = await tokenResponse.text();
      return NextResponse.json(
        { error: `Gagal autentikasi PayPal: ${errorText}` },
        { status: 502 },
      );
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const totalUsd = cartBooks.reduce(
      (sum, entry) => sum + entry.book.priceUsd * entry.quantity,
      0,
    );
    const totalUsdFormatted = totalUsd.toFixed(2);
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
              description: `Pembelian ${cartBooks.length} item novel`,
              amount: {
                currency_code: "USD",
                value: totalUsdFormatted,
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

    const createdOrders = cartBooks.map((entry) =>
      createOrder({
        userId: user.id,
        bookId: entry.book.id,
        title: entry.book.title,
        quantity: entry.quantity,
        paymentMethod: "paypal",
        status: "pending_payment",
        totalUsd: Number((entry.book.priceUsd * entry.quantity).toFixed(2)),
        totalIdr: entry.book.priceIdr * entry.quantity,
        ebookDriveUrl: entry.book.ebookDriveUrl,
        paymentReference: orderData.id,
        checkoutUrl: approveLink.href,
      }),
    );

    return NextResponse.json({
      provider: "paypal",
      orderId: orderData.id,
      checkoutUrl: approveLink.href,
      orders: createdOrders,
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses checkout cart PayPal." },
      { status: 500 },
    );
  }
}
