import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import {
  findOrderByIdForUser,
  replacePendingPaymentReference,
  updateOrdersCheckoutUrl,
  updateOrdersPaymentStatus,
} from "@/lib/orders";
import { buildSolanaPayUrl, getPyusdSolanaConfig } from "@/lib/pyusd-solana";

type PaypalOrderResponse = {
  id: string;
  status?: string;
  links?: Array<{ rel?: string; href?: string }>;
};

type MidtransStatusResponse = {
  transaction_status?: string;
  fraud_status?: string;
  redirect_url?: string;
};

function getPaypalBaseUrl() {
  return process.env.PAYPAL_BASE_URL ?? "https://api-m.sandbox.paypal.com";
}

function getOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function getPaypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Konfigurasi PayPal belum lengkap.");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Gagal autentikasi PayPal.");
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function getPaypalOrder(orderId: string) {
  const accessToken = await getPaypalAccessToken();
  const response = await fetch(
    `${getPaypalBaseUrl()}/v2/checkout/orders/${orderId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as PaypalOrderResponse;
}

async function createPaypalOrderForResume(order: {
  title: string;
  totalUsd: number;
}) {
  const accessToken = await getPaypalAccessToken();
  const total = order.totalUsd.toFixed(2);
  const origin = getOrigin();

  const response = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: `Pembelian novel: ${order.title}`,
          amount: {
            currency_code: "USD",
            value: total,
          },
        },
      ],
      application_context: {
        return_url: `${origin}/api/checkout/paypal/capture`,
        cancel_url: `${origin}/?checkout=cancel&method=paypal`,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gagal membuat order PayPal baru: ${errorText}`);
  }

  const orderData = (await response.json()) as PaypalOrderResponse;
  const checkoutUrl =
    orderData.links?.find((item) => item.rel === "approve")?.href ?? null;
  if (!checkoutUrl) {
    throw new Error("Link approval PayPal tidak ditemukan.");
  }

  return {
    paymentReference: orderData.id,
    checkoutUrl,
  };
}

function getMidtransApiBaseUrl() {
  return process.env.MIDTRANS_API_BASE_URL ?? "https://api.sandbox.midtrans.com";
}

function getMidtransSnapBaseUrl() {
  return process.env.MIDTRANS_SNAP_BASE_URL ?? "https://app.sandbox.midtrans.com";
}

function getMidtransAuthHeader() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error("Konfigurasi Midtrans belum lengkap.");
  }

  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

function mapMidtransStatus(
  transactionStatus: string | undefined,
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

async function getMidtransTransactionStatus(orderId: string) {
  const response = await fetch(`${getMidtransApiBaseUrl()}/v2/${orderId}/status`, {
    headers: {
      Authorization: getMidtransAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MidtransStatusResponse;
}

async function createMidtransOrderForResume(
  order: {
    bookId: string;
    title: string;
    quantity: number;
    totalIdr: number;
  },
  user: {
    name: string;
    email: string;
  },
) {
  const origin = getOrigin();
  const orderId = `NOVEL-RESUME-${Date.now()}`;
  const itemPrice = Math.max(1, Math.round(order.totalIdr / order.quantity));

  const response = await fetch(
    `${getMidtransSnapBaseUrl()}/snap/v1/transactions`,
    {
      method: "POST",
      headers: {
        Authorization: getMidtransAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: order.totalIdr,
        },
        item_details: [
          {
            id: order.bookId,
            name: order.title,
            price: itemPrice,
            quantity: order.quantity,
          },
        ],
        customer_details: {
          first_name: user.name || "Pelanggan Novel",
          email: user.email || "customer@example.com",
        },
        callbacks: {
          finish: `${origin}/api/checkout/midtrans/finish`,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gagal membuat transaksi Midtrans baru: ${errorText}`);
  }

  const data = (await response.json()) as { redirect_url?: string };
  if (!data.redirect_url) {
    throw new Error("Redirect URL Midtrans tidak ditemukan.");
  }

  return {
    paymentReference: orderId,
    checkoutUrl: data.redirect_url,
  };
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

  if (order.status !== "pending_payment") {
    return NextResponse.json(
      { error: "Order ini tidak dalam status pending payment." },
      { status: 400 },
    );
  }

  try {
    if (order.paymentMethod === "paypal") {
      const existing = await getPaypalOrder(order.paymentReference);
      const existingStatus = existing?.status ?? "";
      const existingApproveUrl =
        existing?.links?.find((item) => item.rel === "approve")?.href ?? null;

      if (
        existingApproveUrl &&
        (existingStatus === "CREATED" || existingStatus === "PAYER_ACTION_REQUIRED")
      ) {
        updateOrdersCheckoutUrl("paypal", order.paymentReference, existingApproveUrl);
        return NextResponse.json({
          checkoutUrl: existingApproveUrl,
          paymentReference: order.paymentReference,
          resumed: true,
          regenerated: false,
        });
      }

      if (existingStatus === "COMPLETED") {
        updateOrdersPaymentStatus("paypal", order.paymentReference, "paid");
        return NextResponse.json(
          { error: "Order ini sudah dibayar." },
          { status: 409 },
        );
      }

      const regenerated = await createPaypalOrderForResume({
        title: order.title,
        totalUsd: order.totalUsd,
      });
      replacePendingPaymentReference(
        "paypal",
        order.paymentReference,
        regenerated.paymentReference,
        regenerated.checkoutUrl,
      );

      return NextResponse.json({
        checkoutUrl: regenerated.checkoutUrl,
        paymentReference: regenerated.paymentReference,
        resumed: false,
        regenerated: true,
      });
    }

    if (order.paymentMethod === "pyusd") {
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

      const checkoutUrl = buildSolanaPayUrl({
        recipient: config.merchantWallet,
        amountUsd: order.totalUsd,
        mint: config.mint,
        reference: order.paymentReference,
        label: "EVRIT Store",
        message: `Order ${order.paymentReference}`,
        cluster: config.cluster,
      });
      updateOrdersCheckoutUrl("pyusd", order.paymentReference, checkoutUrl);

      return NextResponse.json({
        checkoutUrl,
        paymentReference: order.paymentReference,
        resumed: true,
        regenerated: false,
      });
    }

    const midtransStatus = await getMidtransTransactionStatus(order.paymentReference);
    const mappedStatus = mapMidtransStatus(
      midtransStatus?.transaction_status,
      midtransStatus?.fraud_status,
    );

    if (mappedStatus === "paid") {
      updateOrdersPaymentStatus("midtrans", order.paymentReference, "paid");
      return NextResponse.json(
        { error: "Order ini sudah dibayar." },
        { status: 409 },
      );
    }

    if (mappedStatus === "failed") {
      updateOrdersPaymentStatus("midtrans", order.paymentReference, "failed");
    }

    if (mappedStatus === "pending_payment") {
      const pendingUrl = midtransStatus?.redirect_url || order.checkoutUrl || null;
      if (pendingUrl) {
        updateOrdersCheckoutUrl("midtrans", order.paymentReference, pendingUrl);
        return NextResponse.json({
          checkoutUrl: pendingUrl,
          paymentReference: order.paymentReference,
          resumed: true,
          regenerated: false,
        });
      }
    }

    const regenerated = await createMidtransOrderForResume(
      {
        bookId: order.bookId,
        title: order.title,
        quantity: order.quantity,
        totalIdr: order.totalIdr,
      },
      {
        name: user.name,
        email: user.email,
      },
    );
    replacePendingPaymentReference(
      "midtrans",
      order.paymentReference,
      regenerated.paymentReference,
      regenerated.checkoutUrl,
    );

    return NextResponse.json({
      checkoutUrl: regenerated.checkoutUrl,
      paymentReference: regenerated.paymentReference,
      resumed: false,
      regenerated: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal melanjutkan pembayaran.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
