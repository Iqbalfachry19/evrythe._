import { NextResponse, type NextRequest } from "next/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/next";
import { getLocalX402Facilitator } from "@/lib/x402-facilitator";

export const runtime = "nodejs";

type VerifyPayload = {
  paymentPayload?: PaymentPayload;
  paymentRequirements?: PaymentRequirements;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyPayload;
    if (!body.paymentPayload || !body.paymentRequirements) {
      return NextResponse.json(
        {
          isValid: false,
          invalidReason: "invalid_request",
          invalidMessage: "paymentPayload dan paymentRequirements wajib diisi.",
        },
        { status: 400 },
      );
    }

    const facilitator = await getLocalX402Facilitator();
    const result = await facilitator.verify(
      body.paymentPayload,
      body.paymentRequirements,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal verify pembayaran x402.";
    return NextResponse.json(
      {
        isValid: false,
        invalidReason: "facilitator_error",
        invalidMessage: message,
      },
      { status: 500 },
    );
  }
}
