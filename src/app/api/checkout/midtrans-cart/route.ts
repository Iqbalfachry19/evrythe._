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
  customerName?: string;
  customerEmail?: string;
};

const MIDTRANS_SNAP_SANDBOX_BASE_URL = "https://app.sandbox.midtrans.com";

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

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return NextResponse.json(
        { error: "Konfigurasi Midtrans belum lengkap. Isi MIDTRANS_SERVER_KEY." },
        { status: 500 },
      );
    }

    const orderId = `NOVEL-CART-${Date.now()}`;
    const grossAmount = cartBooks.reduce(
      (sum, entry) => sum + entry.book.priceIdr * entry.quantity,
      0,
    );
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const transactionResponse = await fetch(
      `${MIDTRANS_SNAP_SANDBOX_BASE_URL}/snap/v1/transactions`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: orderId,
            gross_amount: grossAmount,
          },
          item_details: cartBooks.map((entry) => ({
            id: entry.book.id,
            name: entry.book.title,
            price: entry.book.priceIdr,
            quantity: entry.quantity,
          })),
          customer_details: {
            first_name: body.customerName || user.name || "Pelanggan Novel",
            email: body.customerEmail || user.email || "customer@example.com",
          },
          callbacks: {
            finish: `${origin}/api/checkout/midtrans/finish`,
          },
        }),
      },
    );

    if (!transactionResponse.ok) {
      const errorText = await transactionResponse.text();
      return NextResponse.json(
        { error: `Gagal membuat transaksi Midtrans: ${errorText}` },
        { status: 502 },
      );
    }

    const transactionData = (await transactionResponse.json()) as {
      token?: string;
      redirect_url?: string;
    };

    if (!transactionData.redirect_url) {
      return NextResponse.json(
        { error: "Redirect URL Midtrans tidak ditemukan." },
        { status: 502 },
      );
    }

    const createdOrders = cartBooks.map((entry) =>
      createOrder({
        userId: user.id,
        bookId: entry.book.id,
        title: entry.book.title,
        quantity: entry.quantity,
        paymentMethod: "midtrans",
        status: "pending_payment",
        totalUsd: Number((entry.book.priceUsd * entry.quantity).toFixed(2)),
        totalIdr: entry.book.priceIdr * entry.quantity,
        ebookDriveUrl: entry.book.ebookDriveUrl,
        paymentReference: orderId,
        checkoutUrl: transactionData.redirect_url,
      }),
    );

    return NextResponse.json({
      provider: "midtrans",
      orderId,
      snapToken: transactionData.token,
      checkoutUrl: transactionData.redirect_url,
      orders: createdOrders,
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses checkout cart Midtrans." },
      { status: 500 },
    );
  }
}
