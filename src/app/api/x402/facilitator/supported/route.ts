import { NextResponse } from "next/server";
import { getLocalX402Facilitator } from "@/lib/x402-facilitator";

export const runtime = "nodejs";

export async function GET() {
  try {
    const facilitator = await getLocalX402Facilitator();
    return NextResponse.json(facilitator.getSupported());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat supported x402 facilitator.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
