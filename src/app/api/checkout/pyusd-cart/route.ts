import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createOrder } from "@/lib/orders";
import { findNovelById } from "@/lib/novels-store";
import { buildSolanaPayUrl, getPyusdSolanaConfig } from "@/lib/pyusd-solana";

type CartItemPayload = {
  bookId?: string;
  quantity?: number;
};

type CheckoutPayload = {
  items?: CartItemPayload[];
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
    const items = body.items ?? [];
    if (items.length === 0) {
      return NextResponse.json({ error: "Cart kosong." }, { status: 400 });
    }

    const normalized = items
      .map((item) => ({
        bookId: item.bookId ?? "",
        quantity: Number(item.quantity ?? 0),
      }))
      .filter((item) => item.bookId && Number.isFinite(item.quantity) && item.quantity > 0);

    if (normalized.length === 0) {
      return NextResponse.json({ error: "Data cart tidak valid." }, { status: 400 });
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

    const totalUsd = Number(
      cartBooks
        .reduce((sum, entry) => sum + entry.book.priceUsd * entry.quantity, 0)
        .toFixed(2),
    );
    const paymentReference = `PYUSD-SOL-CART-${Date.now()}`;
    const checkoutUrl = buildSolanaPayUrl({
      recipient: config.merchantWallet,
      amountUsd: totalUsd,
      mint: config.mint,
      reference: paymentReference,
      label: "EVRIT Store",
      message: `Cart ${paymentReference}`,
      cluster: config.cluster,
    });

    const createdOrders = cartBooks.map((entry) =>
      createOrder({
        userId: user.id,
        bookId: entry.book.id,
        title: entry.book.title,
        quantity: entry.quantity,
        paymentMethod: "pyusd",
        status: "pending_payment",
        totalUsd: Number((entry.book.priceUsd * entry.quantity).toFixed(2)),
        totalIdr: entry.book.priceIdr * entry.quantity,
        ebookDriveUrl: entry.book.ebookDriveUrl,
        paymentReference,
        checkoutUrl,
      }),
    );

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
      orders: createdOrders,
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses checkout cart PYUSD Solana." },
      { status: 500 },
    );
  }
}
