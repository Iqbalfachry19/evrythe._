import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { findOrderByIdForUser, updateOrdersPaymentStatus } from "@/lib/orders";
import {
  buildX402Paywall,
  buildX402RouteConfig,
  ensureX402Initialized,
  x402Server,
  x402WithPayment,
} from "@/lib/x402";
import { getPyusdSolanaConfig } from "@/lib/pyusd-solana";

export const runtime = "nodejs";

async function settleHandler(request: NextRequest): Promise<NextResponse> {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Silakan login dulu." },
      { status: 401 },
    );
  }

  const orderId = request.nextUrl.searchParams.get("orderId")?.trim() ?? "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId wajib diisi." }, { status: 400 });
  }

  const order = findOrderByIdForUser(orderId, user.id);
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  if (order.paymentMethod !== "pyusd") {
    return NextResponse.json(
      { error: "Order ini bukan metode X402 (PYUSD)." },
      { status: 400 },
    );
  }

  if (order.status !== "pending_payment") {
    return NextResponse.json(
      { error: "Order ini tidak dalam status pending payment." },
      { status: 400 },
    );
  }

  updateOrdersPaymentStatus("pyusd", order.paymentReference, "paid");
  return NextResponse.json({
    ok: true,
    orderId: order.id,
    paymentReference: order.paymentReference,
    method: "x402",
  });
}

type ProtectedHandler = (request: NextRequest) => Promise<NextResponse>;

let x402InitError: string | null = null;
let protectedSettleHandler: ProtectedHandler | null = null;

const paywallProvider = buildX402Paywall();

const pyusdConfig = getPyusdSolanaConfig();
if (!pyusdConfig.merchantWallet) {
  x402InitError =
    "X402 belum siap: PYUSD_SOLANA_MERCHANT_WALLET belum dikonfigurasi.";
} else {
  try {
    protectedSettleHandler = x402WithPayment<unknown>(
      settleHandler,
      buildX402RouteConfig(),
      x402Server,
      {
        appName: "EVRIT Store",
        testnet: pyusdConfig.cluster !== "mainnet" && pyusdConfig.cluster !== "mainnet-beta",
      },
      paywallProvider,
      false,
    ) as ProtectedHandler;
  } catch (error) {
    x402InitError =
      error instanceof Error
        ? `Gagal inisialisasi x402: ${error.message}`
        : "Gagal inisialisasi x402.";
  }
}

async function runProtected(request: NextRequest) {
  if (x402InitError || !protectedSettleHandler) {
    return NextResponse.json(
      { error: x402InitError ?? "X402 belum siap." },
      { status: 500 },
    );
  }

  try {
    await ensureX402Initialized();
    return await protectedSettleHandler(request);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan pada x402.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return runProtected(request);
}

export async function POST(request: NextRequest) {
  return runProtected(request);
}
