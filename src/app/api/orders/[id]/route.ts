import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { findOrderByIdForUser, listOrdersByUser } from "@/lib/orders";

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
    return NextResponse.json(
      { error: "Order tidak ditemukan." },
      { status: 404 },
    );
  }

  const groupedItems = listOrdersByUser(user.id).filter(
    (entry) =>
      entry.paymentMethod === order.paymentMethod &&
      entry.paymentReference === order.paymentReference,
  );

  const totalQty = groupedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalUsd = Number(
    groupedItems.reduce((sum, item) => sum + item.totalUsd, 0).toFixed(2),
  );
  const totalIdr = groupedItems.reduce((sum, item) => sum + item.totalIdr, 0);
  const latestCreatedAt = groupedItems.reduce(
    (latest, item) => (item.createdAt > latest ? item.createdAt : latest),
    order.createdAt,
  );

  return NextResponse.json({
    order,
    group: {
      paymentMethod: order.paymentMethod,
      paymentReference: order.paymentReference,
      status: order.status,
      totalQty,
      totalUsd,
      totalIdr,
      latestCreatedAt,
      items: groupedItems,
    },
  });
}
