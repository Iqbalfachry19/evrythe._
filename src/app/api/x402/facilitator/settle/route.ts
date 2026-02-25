import { NextResponse, type NextRequest } from "next/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/next";
import { getLocalX402Facilitator } from "@/lib/x402-facilitator";

export const runtime = "nodejs";

type SettlePayload = {
  paymentPayload?: PaymentPayload;
  paymentRequirements?: PaymentRequirements;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SettlePayload;
    if (!body.paymentPayload || !body.paymentRequirements) {
      return NextResponse.json(
        {
          success: false,
          errorReason: "invalid_request",
          errorMessage: "paymentPayload dan paymentRequirements wajib diisi.",
          transaction: "",
          network: body.paymentRequirements?.network ?? "solana:unknown",
        },
        { status: 400 },
      );
    }

    const facilitator = await getLocalX402Facilitator();
    const result = await facilitator.settle(
      body.paymentPayload,
      body.paymentRequirements,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal settle pembayaran x402.";
    return NextResponse.json(
      {
        success: false,
        errorReason: "facilitator_error",
        errorMessage: message,
        transaction: "",
        network: "solana:unknown",
      },
      { status: 500 },
    );
  }
}
