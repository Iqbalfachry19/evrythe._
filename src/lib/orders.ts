export type OrderRecord = {
  id: string;
  userId: string;
  bookId: string;
  title: string;
  quantity: number;
  paymentMethod: "paypal" | "midtrans" | "pyusd";
  status: "pending_payment" | "paid" | "failed";
  totalUsd: number;
  totalIdr: number;
  ebookDriveUrl?: string;
  paymentReference: string;
  checkoutUrl?: string;
  createdAt: string;
  updatedAt: string;
};

type OrdersStore = {
  orders: OrderRecord[];
  pyusdVerifiedSignatures: Record<string, string>;
};

function getOrdersStore(): OrdersStore {
  const globalState = globalThis as typeof globalThis & {
    __EVRIT_ORDERS_STORE__?: OrdersStore;
  };

  if (!globalState.__EVRIT_ORDERS_STORE__) {
    globalState.__EVRIT_ORDERS_STORE__ = {
      orders: [],
      pyusdVerifiedSignatures: {},
    };
  }

  // Backward-compatible guard for older in-memory store shape.
  if (!globalState.__EVRIT_ORDERS_STORE__.pyusdVerifiedSignatures) {
    globalState.__EVRIT_ORDERS_STORE__.pyusdVerifiedSignatures = {};
  }

  return globalState.__EVRIT_ORDERS_STORE__;
}

export function createOrder(
  order: Omit<OrderRecord, "id" | "createdAt" | "updatedAt">,
) {
  const store = getOrdersStore();
  const now = new Date().toISOString();
  const created: OrderRecord = {
    ...order,
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };

  store.orders.unshift(created);
  return created;
}

export function listOrdersByUser(userId: string) {
  const store = getOrdersStore();
  return store.orders.filter((order) => order.userId === userId);
}

export function findOrderByIdForUser(orderId: string, userId: string) {
  const store = getOrdersStore();
  return (
    store.orders.find((order) => order.id === orderId && order.userId === userId) ?? null
  );
}

export function findOrderById(orderId: string) {
  const store = getOrdersStore();
  return store.orders.find((order) => order.id === orderId) ?? null;
}

export function updateOrderPaymentStatus(
  paymentMethod: OrderRecord["paymentMethod"],
  paymentReference: string,
  status: OrderRecord["status"],
) {
  const store = getOrdersStore();
  const found = store.orders.find(
    (order) =>
      order.paymentMethod === paymentMethod &&
      order.paymentReference === paymentReference,
  );

  if (!found) {
    return null;
  }

  found.status = status;
  if (status !== "pending_payment") {
    found.checkoutUrl = undefined;
  }
  found.updatedAt = new Date().toISOString();
  return found;
}

export function bindPyusdSignatureToPaymentReference(
  signature: string,
  paymentReference: string,
) {
  const store = getOrdersStore();
  const existing = store.pyusdVerifiedSignatures[signature];
  if (existing && existing !== paymentReference) {
    return {
      ok: false as const,
      existingPaymentReference: existing,
    };
  }

  store.pyusdVerifiedSignatures[signature] = paymentReference;
  return {
    ok: true as const,
    existingPaymentReference: existing ?? paymentReference,
  };
}

export function updateOrdersPaymentStatus(
  paymentMethod: OrderRecord["paymentMethod"],
  paymentReference: string,
  status: OrderRecord["status"],
) {
  const store = getOrdersStore();
  const now = new Date().toISOString();
  const found = store.orders.filter(
    (order) =>
      order.paymentMethod === paymentMethod &&
      order.paymentReference === paymentReference,
  );

  if (found.length === 0) {
    return [];
  }

  found.forEach((order) => {
    order.status = status;
    if (status !== "pending_payment") {
      order.checkoutUrl = undefined;
    }
    order.updatedAt = now;
  });

  return found;
}

export function updateOrdersCheckoutUrl(
  paymentMethod: OrderRecord["paymentMethod"],
  paymentReference: string,
  checkoutUrl: string,
) {
  const store = getOrdersStore();
  const now = new Date().toISOString();
  const found = store.orders.filter(
    (order) =>
      order.paymentMethod === paymentMethod &&
      order.paymentReference === paymentReference,
  );

  found.forEach((order) => {
    order.checkoutUrl = checkoutUrl;
    order.updatedAt = now;
  });

  return found;
}

export function replacePendingPaymentReference(
  paymentMethod: OrderRecord["paymentMethod"],
  oldPaymentReference: string,
  nextPaymentReference: string,
  checkoutUrl: string,
) {
  const store = getOrdersStore();
  const now = new Date().toISOString();
  const found = store.orders.filter(
    (order) =>
      order.paymentMethod === paymentMethod &&
      order.paymentReference === oldPaymentReference &&
      order.status === "pending_payment",
  );

  found.forEach((order) => {
    order.paymentReference = nextPaymentReference;
    order.checkoutUrl = checkoutUrl;
    order.updatedAt = now;
  });

  return found;
}
