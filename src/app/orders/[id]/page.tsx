"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type SolanaProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey?: { toString: () => string } }>;
};

type WindowWithSolana = Window & {
  solana?: SolanaProvider;
  phantom?: { solana?: SolanaProvider };
  solflare?: SolanaProvider;
};

type Order = {
  id: string;
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

type OrderGroup = {
  paymentMethod: "paypal" | "midtrans" | "pyusd";
  paymentReference: string;
  status: "pending_payment" | "paid" | "failed";
  totalQty: number;
  totalUsd: number;
  totalIdr: number;
  latestCreatedAt: string;
  items: Order[];
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

function isLocalhostHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [orderGroup, setOrderGroup] = useState<OrderGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [pyusdCheckoutUrl, setPyusdCheckoutUrl] = useState("");
  const [copiedPaymentUrl, setCopiedPaymentUrl] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [ratingInput, setRatingInput] = useState("5");
  const [commentInput, setCommentInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshUntil, setAutoRefreshUntil] = useState<number | null>(null);

  function triggerAutoRefreshWindow() {
    setAutoRefreshUntil(Date.now() + 2 * 60 * 1000);
  }

  const loadOrder = useCallback(async (): Promise<Order | null> => {
    if (!orderId) {
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      const data = (await response.json()) as {
        order?: Order;
        group?: OrderGroup;
        error?: string;
      };
      if (!response.ok || !data.order) {
        throw new Error(data.error || "Gagal memuat order.");
      }
      setOrder(data.order);
      setOrderGroup(data.group ?? null);
      if (data.order.paymentMethod === "pyusd" && data.order.checkoutUrl) {
        setPyusdCheckoutUrl(data.order.checkoutUrl);
      }
      return data.order;
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Terjadi kesalahan.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const loadReview = useCallback(async () => {
    if (!orderId) {
      return;
    }

    try {
      setReviewLoading(true);
      const response = await fetch(`/api/orders/${orderId}/review`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { review?: Review | null };
      if (!response.ok) {
        return;
      }

      setReview(data.review ?? null);
      if (data.review) {
        setRatingInput(String(data.review.rating));
        setCommentInput(data.review.comment ?? "");
      }
    } finally {
      setReviewLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (order?.status === "paid") {
      void loadReview();
    }
  }, [order?.status, loadReview]);

  useEffect(() => {
    if (
      !order ||
      order.paymentMethod !== "pyusd" ||
      order.status !== "pending_payment" ||
      !autoRefreshUntil
    ) {
      return;
    }

    if (Date.now() > autoRefreshUntil) {
      setAutoRefreshUntil(null);
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (Date.now() > autoRefreshUntil) {
        setAutoRefreshUntil(null);
        return;
      }
      void loadOrder();
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [order, loadOrder, autoRefreshUntil]);

  useEffect(() => {
    if (order?.status === "paid" || order?.status === "failed") {
      setAutoRefreshUntil(null);
    }
  }, [order?.status]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as { type?: string } | null;
      if (data?.type === "x402-payment-success") {
        void loadOrder();
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [loadOrder]);

  async function resumePayment(options?: { redirect?: boolean }) {
    if (!order) {
      return;
    }

    try {
      setResuming(true);
      setError(null);
      const response = await fetch(`/api/orders/${order.id}/resume`, { method: "POST" });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Gagal melanjutkan pembayaran.");
      }
      if (order.paymentMethod === "pyusd") {
        triggerAutoRefreshWindow();
      }
      if (options?.redirect ?? true) {
        window.location.href = data.checkoutUrl;
      } else {
        setPyusdCheckoutUrl(data.checkoutUrl);
      }
    } catch (resumeError) {
      const message =
        resumeError instanceof Error ? resumeError.message : "Terjadi kesalahan.";
      setError(message);
      setResuming(false);
    }
  }

  async function copyPaymentLink() {
    if (!pyusdCheckoutUrl || typeof navigator === "undefined") {
      return;
    }
    await navigator.clipboard.writeText(pyusdCheckoutUrl);
    setCopiedPaymentUrl(true);
    window.setTimeout(() => setCopiedPaymentUrl(false), 1500);
  }

  async function submitReview() {
    if (!order) {
      return;
    }

    try {
      setReviewSaving(true);
      setError(null);
      const response = await fetch(`/api/orders/${order.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: Number(ratingInput),
          comment: commentInput,
        }),
      });
      const data = (await response.json()) as {
        review?: Review;
        error?: string;
      };

      if (!response.ok || !data.review) {
        throw new Error(data.error || "Gagal menyimpan review.");
      }

      setReview(data.review);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Terjadi kesalahan.";
      setError(message);
    } finally {
      setReviewSaving(false);
    }
  }

  async function checkX402PaymentStatus() {
    if (!order || order.paymentMethod !== "pyusd") {
      return;
    }

    try {
      setCheckingPayment(true);
      setError(null);
      const latestOrder = await loadOrder();
      if (!latestOrder) {
        throw new Error("Gagal memuat status order terbaru.");
      }
      if (latestOrder.status === "pending_payment") {
        throw new Error(
          "Pembayaran belum terkonfirmasi. Selesaikan dulu di paywall/wallet, lalu cek status lagi.",
        );
      }
    } catch (verifyError) {
      const message =
        verifyError instanceof Error ? verifyError.message : "Terjadi kesalahan.";
      setError(message);
    } finally {
      setCheckingPayment(false);
    }
  }

  function openX402Paywall() {
    if (!order) {
      return;
    }
    triggerAutoRefreshWindow();
    const settleUrl = `/api/checkout/x402/settle?orderId=${encodeURIComponent(order.id)}`;
    window.open(settleUrl, "_blank", "noopener,noreferrer");
  }

  function openX402PaywallInPhantomMobile() {
    if (!order || typeof window === "undefined") {
      return;
    }
    triggerAutoRefreshWindow();
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const baseOrigin = configuredAppUrl || window.location.origin;
    let parsedBaseUrl: URL;

    try {
      parsedBaseUrl = new URL(baseOrigin);
    } catch {
      setError("NEXT_PUBLIC_APP_URL tidak valid. Isi dengan URL publik yang benar.");
      return;
    }

    if (isLocalhostHost(parsedBaseUrl.hostname)) {
      setError(
        "Phantom mobile tidak bisa membuka localhost. Set NEXT_PUBLIC_APP_URL ke URL publik (mis. tunnel HTTPS) lalu refresh.",
      );
      return;
    }

    const settleUrl = `${parsedBaseUrl.origin}/api/checkout/x402/settle?orderId=${encodeURIComponent(
      order.id,
    )}`;
    const phantomDeepLink = `https://phantom.app/ul/browse/${encodeURIComponent(
      settleUrl,
    )}?ref=evrit-store`;
    const phantomSchemeLink = `phantom://browse/${encodeURIComponent(settleUrl)}?ref=evrit-store`;
    window.location.href = phantomDeepLink;
    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.href = phantomSchemeLink;
      }
    }, 1200);
  }

  function getSolanaProvider(): SolanaProvider | null {
    if (typeof window === "undefined") {
      return null;
    }
    const walletWindow = window as WindowWithSolana;
    if (walletWindow.phantom?.solana) {
      return walletWindow.phantom.solana;
    }
    if (walletWindow.solflare) {
      return walletWindow.solflare;
    }
    if (walletWindow.solana) {
      return walletWindow.solana;
    }
    return null;
  }

  async function connectWallet() {
    try {
      setConnectingWallet(true);
      setWalletError(null);
      const provider = getSolanaProvider();
      if (!provider) {
        throw new Error("Wallet Solana tidak ditemukan. Install Phantom/Solflare dulu.");
      }
      const result = await provider.connect();
      const address = result.publicKey?.toString() ?? "";
      if (!address) {
        throw new Error("Gagal membaca address wallet.");
      }
      setWalletAddress(address);
    } catch (connectError) {
      const message =
        connectError instanceof Error ? connectError.message : "Gagal connect wallet.";
      setWalletError(message);
    } finally {
      setConnectingWallet(false);
    }
  }

  return (
    <main className="m-4 rounded-3xl border border-indigo-900 bg-indigo-50 p-6 text-indigo-950 shadow-[8px_8px_0_0_rgba(30,27,75,0.9)]">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/" className="text-sm font-semibold text-indigo-700 hover:underline">
          ← Kembali ke halaman utama
        </Link>
        <h1 className="text-3xl font-bold">Detail Order</h1>

        {loading ? <p>Memuat order...</p> : null}
        {error ? (
          <p className="rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {!loading && !error && order ? (
          <section className="rounded-2xl border border-indigo-300 bg-white p-5 shadow-md">
            <p className="text-sm text-indigo-600">Order ID</p>
            <p className="font-mono text-sm">{order.id}</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <p>
                <span className="font-semibold">Metode:</span>{" "}
                {(orderGroup?.paymentMethod ?? order.paymentMethod) === "pyusd"
                  ? "X402 (PYUSD)"
                  : (orderGroup?.paymentMethod ?? order.paymentMethod).toUpperCase()}
              </p>
              <p>
                <span className="font-semibold">Status:</span> {order.status}
              </p>
              <p>
                <span className="font-semibold">Total USD:</span>{" "}
                {(orderGroup?.totalUsd ?? order.totalUsd).toFixed(2)}
              </p>
              <p>
                <span className="font-semibold">Total IDR:</span>{" "}
                {(orderGroup?.totalIdr ?? order.totalIdr).toLocaleString("id-ID")}
              </p>
              <p>
                <span className="font-semibold">Total Qty:</span>{" "}
                {orderGroup?.totalQty ?? order.quantity}
              </p>
              <p className="md:col-span-2">
                <span className="font-semibold">Payment Ref:</span>{" "}
                {order.paymentReference}
              </p>
            </div>

            {orderGroup?.items?.length ? (
              <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <h2 className="text-lg font-bold">Item Dalam Transaksi Ini</h2>
                <ul className="mt-2 space-y-2">
                  {orderGroup.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-indigo-200 bg-white p-3 text-sm"
                    >
                      <p className="font-semibold">{item.title}</p>
                      <p>
                        Qty {item.quantity} • USD {item.totalUsd.toFixed(2)} • Rp{" "}
                        {item.totalIdr.toLocaleString("id-ID")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {order.status === "pending_payment" ? (
              <div className="mt-5 space-y-3">
                {order.paymentMethod !== "pyusd" ? (
                  <button
                    type="button"
                    onClick={() => void resumePayment()}
                    disabled={resuming}
                    className="rounded-lg border border-indigo-500 bg-indigo-300 px-4 py-2 font-semibold text-indigo-950 transition hover:bg-indigo-400 disabled:opacity-60"
                  >
                    {resuming ? "Mempersiapkan..." : "Lanjut Bayar"}
                  </button>
                ) : null}

                {order.paymentMethod === "pyusd" ? (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-sm font-semibold text-indigo-900">
                      Verifikasi Pembayaran X402 (PYUSD Solana)
                    </p>
                    <p className="mt-1 text-xs text-indigo-700">
                      Connect wallet dulu, lalu buka paywall x402 untuk melakukan pembayaran.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void connectWallet()}
                        disabled={connectingWallet}
                        className="rounded-lg border border-indigo-500 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 transition hover:bg-indigo-100 disabled:opacity-60"
                      >
                        {connectingWallet ? "Connecting..." : "Connect Wallet"}
                      </button>
                      {walletAddress ? (
                        <p className="text-xs text-indigo-700">
                          Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                        </p>
                      ) : null}
                    </div>
                    {walletError ? (
                      <p className="mt-2 text-xs text-red-600">{walletError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void resumePayment({ redirect: false })}
                      disabled={resuming || !walletAddress}
                      className="mt-2 rounded-lg border border-indigo-500 bg-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-950 transition hover:bg-indigo-400 disabled:opacity-60"
                    >
                      {resuming ? "Mempersiapkan..." : "Siapkan Link X402"}
                    </button>
                    {!walletAddress ? (
                      <p className="mt-1 text-xs text-indigo-700">
                        Connect wallet dulu untuk mengaktifkan pembayaran X402 (PYUSD).
                      </p>
                    ) : null}
                    {pyusdCheckoutUrl ? (
                      <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
                        <p className="text-xs font-semibold text-indigo-900">Payment Link</p>
                        <input
                          type="text"
                          readOnly
                          value={pyusdCheckoutUrl}
                          className="mt-1 w-full rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-900"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void copyPaymentLink()}
                            className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                          >
                            {copiedPaymentUrl ? "Tersalin" : "Copy Link"}
                          </button>
                          <a
                            href={pyusdCheckoutUrl}
                            className="rounded-md border border-indigo-500 bg-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-950"
                          >
                            Buka di Wallet App
                          </a>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                            pyusdCheckoutUrl,
                          )}`}
                          alt="QR pembayaran X402 PYUSD Solana"
                          className="mt-3 h-40 w-40 rounded border border-indigo-200 bg-white p-1"
                        />
                        <p className="mt-1 text-[11px] text-indigo-700">
                          Scan QR dari wallet mobile jika browser desktop tidak support
                          `solana:`.
                        </p>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={openX402Paywall}
                      disabled={!walletAddress}
                      className="mt-2 rounded-lg border border-indigo-500 bg-indigo-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-60"
                    >
                      Bayar via X402
                    </button>
                    <button
                      type="button"
                      onClick={openX402PaywallInPhantomMobile}
                      disabled={!walletAddress}
                      className="mt-2 rounded-lg border border-indigo-500 bg-indigo-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
                    >
                      Bayar via Phantom Mobile
                    </button>
                    <button
                      type="button"
                      onClick={() => void checkX402PaymentStatus()}
                      disabled={checkingPayment}
                      className="mt-2 rounded-lg border border-indigo-500 bg-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-950 transition hover:bg-indigo-300 disabled:opacity-60"
                    >
                      {checkingPayment ? "Memeriksa..." : "Saya Sudah Bayar (Cek Status)"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {order.status === "paid" && order.ebookDriveUrl ? (
              <a
                href={order.ebookDriveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block rounded-lg border border-indigo-500 bg-indigo-300 px-4 py-2 font-semibold text-indigo-950 transition hover:bg-indigo-400"
              >
                Akses eBook
              </a>
            ) : null}

            {order.status === "paid" ? (
              <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <h2 className="text-lg font-bold">Review Pembelian</h2>
                {reviewLoading ? <p className="mt-2 text-sm">Memuat review...</p> : null}
                {!reviewLoading && review ? (
                  <div className="mt-2 text-sm text-indigo-800">
                    <p>
                      <span className="font-semibold">Rating:</span> {review.rating}/5
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      <span className="font-semibold">Komentar:</span>{" "}
                      {review.comment || "-"}
                    </p>
                    <p className="mt-1 text-xs text-indigo-600">
                      Terakhir diupdate: {new Date(review.updatedAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                ) : null}

                {!reviewLoading ? (
                  <div className="mt-3 grid gap-2">
                    <select
                      value={ratingInput}
                      onChange={(event) => setRatingInput(event.target.value)}
                      className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="5">5 - Sangat bagus</option>
                      <option value="4">4 - Bagus</option>
                      <option value="3">3 - Cukup</option>
                      <option value="2">2 - Kurang</option>
                      <option value="1">1 - Buruk</option>
                    </select>
                    <textarea
                      value={commentInput}
                      onChange={(event) => setCommentInput(event.target.value)}
                      placeholder="Tulis review singkat..."
                      rows={3}
                      className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void submitReview()}
                      disabled={reviewSaving}
                      className="w-fit rounded-lg border border-indigo-500 bg-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-400 disabled:opacity-60"
                    >
                      {reviewSaving ? "Menyimpan..." : review ? "Update Review" : "Kirim Review"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
