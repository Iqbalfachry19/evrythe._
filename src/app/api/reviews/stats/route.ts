import { NextResponse } from "next/server";
import { getReviewStatsByBook } from "@/lib/reviews";

export async function GET() {
  const stats = getReviewStatsByBook();
  return NextResponse.json({ stats });
}
