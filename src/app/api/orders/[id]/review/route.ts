import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { findOrderByIdForUser } from "@/lib/orders";
import { getReviewByOrderForUser, upsertReview } from "@/lib/reviews";

type ReviewPayload = {
  rating?: number;
  comment?: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Silakan login dulu." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const order = findOrderByIdForUser(id, user.id);
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  const review = getReviewByOrderForUser(id, user.id);
  return NextResponse.json({ review });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Silakan login dulu." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const order = findOrderByIdForUser(id, user.id);
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "Review hanya bisa setelah order paid." },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as ReviewPayload;
    const rating = Number(body.rating ?? 0);
    const comment = (body.comment ?? "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating harus angka 1 sampai 5." },
        { status: 400 },
      );
    }

    if (comment.length > 500) {
      return NextResponse.json(
        { error: "Komentar maksimal 500 karakter." },
        { status: 400 },
      );
    }

    const review = upsertReview({
      orderId: order.id,
      userId: user.id,
      userName: user.name,
      bookId: order.bookId,
      rating,
      comment,
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Gagal menyimpan review." },
      { status: 500 },
    );
  }
}
