import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { updateOrdersPaymentStatus } from "@/lib/orders";

type MidtransWebhookPayload = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
};

function getExpectedSignature(payload: MidtransWebhookPayload, serverKey: string) {
  return createHash("sha512")
    .update(
      `${payload.order_id ?? ""}${payload.status_code ?? ""}${payload.gross_amount ?? ""}${serverKey}`,
    )
    .digest("hex");
}

function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string,
): "pending_payment" | "paid" | "failed" {
  if (transactionStatus === "settlement") {
    return "paid";
  }

  if (transactionStatus === "capture") {
    return fraudStatus === "accept" ? "paid" : "pending_payment";
  }

  if (
    transactionStatus === "deny" ||
    transactionStatus === "cancel" ||
    transactionStatus === "expire" ||
    transactionStatus === "failure"
  ) {
    return "failed";
  }

  return "pending_payment";
}

export async function POST(request: Request) {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return NextResponse.json(
        { error: "MIDTRANS_SERVER_KEY belum dikonfigurasi." },
        { status: 500 },
      );
    }

    const payload = (await request.json()) as MidtransWebhookPayload;
    if (
      !payload.order_id ||
      !payload.status_code ||
      !payload.gross_amount ||
      !payload.signature_key ||
      !payload.transaction_status
    ) {
      return NextResponse.json(
        { error: "Payload webhook Midtrans tidak lengkap." },
        { status: 400 },
      );
    }

    const expectedSignature = getExpectedSignature(payload, serverKey);
    if (expectedSignature !== payload.signature_key) {
      return NextResponse.json(
        { error: "Signature Midtrans tidak valid." },
        { status: 401 },
      );
    }

    const status = mapMidtransStatus(
      payload.transaction_status,
      payload.fraud_status,
    );

    const orders = updateOrdersPaymentStatus("midtrans", payload.order_id, status);
    if (orders.length === 0) {
      return NextResponse.json(
        { error: "Order tidak ditemukan untuk webhook Midtrans." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, orders });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses webhook Midtrans." },
      { status: 500 },
    );
  }
}
