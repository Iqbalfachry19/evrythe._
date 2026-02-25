import { NextResponse, type NextRequest } from "next/server";
import { findNovelById } from "@/lib/novels-store";
import { getCurrentUser } from "@/lib/auth-server";
import { createOrder } from "@/lib/orders";

type CheckoutPayload = {
  bookId?: string;
  quantity?: number;
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

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return NextResponse.json(
        { error: "Konfigurasi Midtrans belum lengkap. Isi MIDTRANS_SERVER_KEY." },
        { status: 500 },
      );
    }

    const orderId = `NOVEL-${Date.now()}`;
    const grossAmount = book.priceIdr * quantity;
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
          item_details: [
            {
              id: book.id,
              name: book.title,
              price: book.priceIdr,
              quantity,
            },
          ],
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

    const order = createOrder({
      userId: user.id,
      bookId: book.id,
      title: book.title,
      quantity,
      paymentMethod: "midtrans",
      status: "pending_payment",
      totalUsd: Number((book.priceUsd * quantity).toFixed(2)),
      totalIdr: grossAmount,
      ebookDriveUrl: book.ebookDriveUrl,
      paymentReference: orderId,
      checkoutUrl: transactionData.redirect_url,
    });

    return NextResponse.json({
      provider: "midtrans",
      orderId,
      snapToken: transactionData.token,
      checkoutUrl: transactionData.redirect_url,
      order,
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses pembayaran Midtrans." },
      { status: 500 },
    );
  }
}
