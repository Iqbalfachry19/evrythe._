import { NextResponse, type NextRequest } from "next/server";
import { findNovelById } from "@/lib/novels-store";
import { getCurrentUser } from "@/lib/auth-server";
import { createOrder } from "@/lib/orders";
import { buildSolanaPayUrl, getPyusdSolanaConfig } from "@/lib/pyusd-solana";

type CheckoutPayload = {
  bookId?: string;
  quantity?: number;
};

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login dulu." },
        { status: 401 },
      );
    }

    const config = getPyusdSolanaConfig();
    if (!config.merchantWallet) {
      return NextResponse.json(
        {
          error:
            "PYUSD Solana merchant wallet belum dikonfigurasi (PYUSD_SOLANA_MERCHANT_WALLET).",
        },
        { status: 500 },
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

    const totalUsd = Number((book.priceUsd * quantity).toFixed(2));
    const paymentReference = `PYUSD-SOL-${Date.now()}`;
    const checkoutUrl = buildSolanaPayUrl({
      recipient: config.merchantWallet,
      amountUsd: totalUsd,
      mint: config.mint,
      reference: paymentReference,
      label: "EVRIT Store",
      message: `Order ${paymentReference}`,
      cluster: config.cluster,
    });

    const order = createOrder({
      userId: user.id,
      bookId: book.id,
      title: book.title,
      quantity,
      paymentMethod: "pyusd",
      status: "pending_payment",
      totalUsd,
      totalIdr: book.priceIdr * quantity,
      ebookDriveUrl: book.ebookDriveUrl,
      paymentReference,
      checkoutUrl,
    });

    return NextResponse.json({
      provider: "pyusd_solana",
      orderId: paymentReference,
      checkoutUrl,
      paymentRequest: {
        recipient: config.merchantWallet,
        mint: config.mint,
        amountUsd: totalUsd,
        reference: paymentReference,
        cluster: config.cluster,
      },
      order,
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses pembayaran PYUSD Solana." },
      { status: 500 },
    );
  }
}
