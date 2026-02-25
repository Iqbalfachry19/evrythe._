"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NOVELS, type Novel } from "@/lib/novels";

type PaymentMethod = "paypal" | "midtrans" | "pyusd";
type AuthMode = "login" | "register";

type SolanaProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey?: { toString: () => string } }>;
};

type WindowWithSolana = Window & {
  solana?: SolanaProvider;
  phantom?: { solana?: SolanaProvider };
  solflare?: SolanaProvider;
};

type SafeUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type Order = {
  id: string;
  bookId: string;
  title: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  status: "pending_payment" | "paid" | "failed";
  totalUsd: number;
  totalIdr: number;
  ebookDriveUrl?: string;
  paymentReference: string;
  checkoutUrl?: string;
  createdAt: string;
};

type CartItem = {
  bookId: string;
  quantity: number;
};

type ProductSort = "latest" | "title_asc" | "price_low" | "price_high";
type ProductPriceFilter = "all" | "under_180k" | "180k_to_200k" | "over_200k";
type ReviewStatsMap = Record<string, { averageRating: number; reviewCount: number }>;

const CART_STORAGE_KEY = "evrit_cart_v1";
const CART_BULK_PROCESSING_KEY = "__cart_bulk__";
const PRODUCTS_PER_PAGE = 6;

export default function NovelStore() {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loadingMethod, setLoadingMethod] = useState<PaymentMethod | null>(null);
  const [processingCartBookId, setProcessingCartBookId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [resumingOrderId, setResumingOrderId] = useState<string | null>(null);
  const [novels, setNovels] = useState<Novel[]>(NOVELS);
  const [productSearch, setProductSearch] = useState("");
  const [productSort, setProductSort] = useState<ProductSort>("latest");
  const [productPriceFilter, setProductPriceFilter] =
    useState<ProductPriceFilter>("all");
  const [productPage, setProductPage] = useState(1);
  const [reviewStats, setReviewStats] = useState<ReviewStatsMap>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [showWalletScan, setShowWalletScan] = useState(false);
  const [walletScanUrl, setWalletScanUrl] = useState("");

  const cartDetailed = useMemo(() => {
    return cart
      .map((item) => {
        const book = novels.find((entry) => entry.id === item.bookId);
        if (!book) {
          return null;
        }

        return {
          ...item,
          book,
          totalUsd: Number((book.priceUsd * item.quantity).toFixed(2)),
          totalIdr: book.priceIdr * item.quantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [cart, novels]);

  const cartSubtotalUsd = useMemo(
    () => cartDetailed.reduce((sum, item) => sum + item.totalUsd, 0),
    [cartDetailed],
  );

  const cartSubtotalIdr = useMemo(
    () => cartDetailed.reduce((sum, item) => sum + item.totalIdr, 0),
    [cartDetailed],
  );
  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );
  const groupedOrders = useMemo(() => {
    const groups = new Map<
      string,
      {
        paymentReference: string;
        paymentMethod: PaymentMethod;
        items: Order[];
        totalIdr: number;
        totalUsd: number;
        totalQty: number;
        latestCreatedAt: string;
        status: "pending_payment" | "paid" | "failed";
      }
    >();

    orders.forEach((order) => {
      const key = `${order.paymentMethod}:${order.paymentReference}`;
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          paymentReference: order.paymentReference,
          paymentMethod: order.paymentMethod,
          items: [order],
          totalIdr: order.totalIdr,
          totalUsd: order.totalUsd,
          totalQty: order.quantity,
          latestCreatedAt: order.createdAt,
          status: order.status,
        });
        return;
      }

      existing.items.push(order);
      existing.totalIdr += order.totalIdr;
      existing.totalUsd += order.totalUsd;
      existing.totalQty += order.quantity;
      if (order.createdAt > existing.latestCreatedAt) {
        existing.latestCreatedAt = order.createdAt;
      }

      if (existing.status === "pending_payment" || order.status === "pending_payment") {
        existing.status = "pending_payment";
      } else if (existing.status === "failed" || order.status === "failed") {
        existing.status = "failed";
      } else {
        existing.status = "paid";
      }
    });

    return Array.from(groups.values()).sort((a, b) =>
      b.latestCreatedAt.localeCompare(a.latestCreatedAt),
    );
  }, [orders]);
  const latestGroupedOrders = useMemo(() => groupedOrders.slice(0, 5), [groupedOrders]);
  const filteredNovels = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const filtered = novels.filter((book) => {
      const matchesQuery =
        !query ||
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.description.toLowerCase().includes(query);

      let matchesPrice = true;
      if (productPriceFilter === "under_180k") {
        matchesPrice = book.priceIdr < 180000;
      } else if (productPriceFilter === "180k_to_200k") {
        matchesPrice = book.priceIdr >= 180000 && book.priceIdr <= 200000;
      } else if (productPriceFilter === "over_200k") {
        matchesPrice = book.priceIdr > 200000;
      }

      return matchesQuery && matchesPrice;
    });

    if (productSort === "title_asc") {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (productSort === "price_low") {
      return [...filtered].sort((a, b) => a.priceIdr - b.priceIdr);
    }
    if (productSort === "price_high") {
      return [...filtered].sort((a, b) => b.priceIdr - a.priceIdr);
    }

    return filtered;
  }, [novels, productSearch, productSort, productPriceFilter]);
  const totalProductPages = useMemo(
    () => Math.max(1, Math.ceil(filteredNovels.length / PRODUCTS_PER_PAGE)),
    [filteredNovels.length],
  );
  const displayedNovels = useMemo(() => {
    const start = (productPage - 1) * PRODUCTS_PER_PAGE;
    return filteredNovels.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredNovels, productPage]);

  useEffect(() => {
    setProductPage(1);
  }, [productSearch, productSort, productPriceFilter]);

  useEffect(() => {
    if (productPage > totalProductPages) {
      setProductPage(totalProductPages);
    }
  }, [productPage, totalProductPages]);

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = (await response.json()) as { orders?: Order[] };

      if (!response.ok) {
        setOrders([]);
        return;
      }

      setOrders(data.orders ?? []);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await response.json()) as { user?: SafeUser | null };

      if (!response.ok || !data.user) {
        setUser(null);
        setOrders([]);
        return;
      }

      setUser(data.user);
      setCustomerName(data.user.name ?? "");
      setCustomerEmail(data.user.email ?? "");
      await loadOrders();
    } catch {
      setUser(null);
      setOrders([]);
    }
  }, [loadOrders]);

  const loadNovels = useCallback(async () => {
    try {
      const response = await fetch("/api/novels", { cache: "no-store" });
      const data = (await response.json()) as { novels?: Novel[] };
      if (!response.ok || !Array.isArray(data.novels)) {
        return;
      }

      setNovels(data.novels);
    } catch {
      // Keep fallback novels from local constants.
    }
  }, []);

  const loadReviewStats = useCallback(async () => {
    try {
      const response = await fetch("/api/reviews/stats", { cache: "no-store" });
      const data = (await response.json()) as { stats?: ReviewStatsMap };
      if (!response.ok || !data.stats) {
        return;
      }

      setReviewStats(data.stats);
    } catch {
      // Ignore if no stats yet.
    }
  }, []);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    void loadNovels();
  }, [loadNovels]);

  useEffect(() => {
    void loadReviewStats();
  }, [loadReviewStats]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as CartItem[];
      if (!Array.isArray(parsed)) {
        return;
      }

      const normalized = parsed
        .map((item) => ({
          bookId: item.bookId,
          quantity: Number(item.quantity ?? 0),
        }))
        .filter((item) => item.bookId && item.quantity > 0);

      setCart(normalized);
    } catch {
      setCart([]);
    } finally {
      setIsCartHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isCartHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart, isCartHydrated]);

  function addToCart(bookId: string) {
    setCart((prev) => {
      const existing = prev.find((item) => item.bookId === bookId);
      if (existing) {
        return prev.map((item) =>
          item.bookId === bookId
            ? { ...item, quantity: Math.min(item.quantity + 1, 99) }
            : item,
        );
      }

      return [...prev, { bookId, quantity: 1 }];
    });
  }

  function updateCartQty(bookId: string, nextQty: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.bookId === bookId
            ? { ...item, quantity: Math.max(1, Math.min(nextQty, 99)) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(bookId: string) {
    setCart((prev) => prev.filter((item) => item.bookId !== bookId));
  }

  async function handleAuthSubmit() {
    try {
      setAuthLoading(true);
      setError(null);

      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        authMode === "login"
          ? { email: authEmail, password: authPassword }
          : {
              name: authName,
              email: authEmail,
              password: authPassword,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        user?: SafeUser;
        error?: string;
      };

      if (!response.ok || !data.user) {
        throw new Error(data.error || "Gagal autentikasi.");
      }

      setUser(data.user);
      setCustomerName(data.user.name);
      setCustomerEmail(data.user.email);
      setAuthPassword("");
      await loadOrders();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setOrders([]);
    }
  }

  async function resumePendingPayment(order: Order) {
    try {
      setError(null);
      setResumingOrderId(order.id);

      const response = await fetch(`/api/orders/${order.id}/resume`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Gagal melanjutkan pembayaran.");
      }

      await loadOrders();
      window.location.href = data.checkoutUrl;
    } catch (resumeError) {
      const message =
        resumeError instanceof Error
          ? resumeError.message
          : "Gagal melanjutkan pembayaran.";
      setError(message);
    } finally {
      setResumingOrderId(null);
    }
  }

  async function startCheckout(
    method: PaymentMethod,
    payload: { bookId: string; quantity: number },
  ) {
    if (!user) {
      setError("Silakan login dulu untuk melakukan checkout.");
      return;
    }
    if (method === "pyusd" && !walletAddress) {
      setError("Connect wallet Solana dulu untuk pembayaran X402 (PYUSD).");
      return;
    }

    try {
      setError(null);
      setLoadingMethod(method);
      setProcessingCartBookId(payload.bookId);

      const checkoutMethodEndpoint = method === "pyusd" ? "x402" : method;
      const response = await fetch(`/api/checkout/${checkoutMethodEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          customerName,
          customerEmail,
        }),
      });

      const data = (await response.json()) as {
        checkoutUrl?: string;
        order?: Order;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Gagal memulai checkout.");
      }

      if (method === "pyusd" && data.order?.id) {
        window.location.href = `/orders/${data.order.id}`;
        return;
      }

      if (!data.checkoutUrl) {
        throw new Error("Gagal memulai checkout.");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(message);
    } finally {
      setLoadingMethod(null);
      setProcessingCartBookId(null);
    }
  }

  async function startCartCheckout(method: PaymentMethod) {
    if (!user) {
      setError("Silakan login dulu untuk melakukan checkout.");
      return;
    }
    if (method === "pyusd" && !walletAddress) {
      setError("Connect wallet Solana dulu untuk checkout X402 (PYUSD).");
      return;
    }

    if (cart.length === 0) {
      setError("Cart masih kosong.");
      return;
    }

    try {
      setError(null);
      setLoadingMethod(method);
      setProcessingCartBookId(CART_BULK_PROCESSING_KEY);

      const checkoutMethodEndpoint = method === "pyusd" ? "x402" : method;
      const response = await fetch(`/api/checkout/${checkoutMethodEndpoint}-cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart,
          customerName,
          customerEmail,
        }),
      });

      const data = (await response.json()) as {
        checkoutUrl?: string;
        orders?: Order[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Gagal memulai checkout cart.");
      }

      if (method === "pyusd" && data.orders?.[0]?.id) {
        setCart([]);
        window.location.href = `/orders/${data.orders[0].id}`;
        return;
      }

      if (!data.checkoutUrl) {
        throw new Error("Gagal memulai checkout cart.");
      }

      // Checkout cart created successfully, clear local cart before redirect.
      setCart([]);
      window.location.href = data.checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(message);
    } finally {
      setLoadingMethod(null);
      setProcessingCartBookId(null);
    }
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
      setError(null);
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

  function openWalletScan() {
    if (typeof window === "undefined") {
      return;
    }
    const currentUrl = window.location.href;
    const phantomBrowseUrl = `https://phantom.app/ul/browse/${encodeURIComponent(
      currentUrl,
    )}?ref=evrit-store`;
    setWalletScanUrl(phantomBrowseUrl);
    setShowWalletScan(true);
  }

  return (
    <section className="my-12 sm:my-16 rounded-[24px] sm:rounded-3xl border border-indigo-900 bg-gradient-to-br from-indigo-50 via-white to-indigo-100/70 p-4 sm:p-6 shadow-[6px_6px_0_0_rgba(30,27,75,0.95)] sm:shadow-[8px_8px_0_0_rgba(30,27,75,0.95)]">
      <div className="mb-6 rounded-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-800 p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-3xl font-black tracking-tight">Novel Store</h2>
          <div className="rounded-full bg-[#a5b4fc] px-3 py-1 text-xs font-bold text-[#1e1b4b]">
            Cart: {cartItemCount}
          </div>
        </div>
        <p className="mt-1 text-sm text-indigo-100">
          Belanja novel dengan nuansa indigo: pilih buku, atur cart, lalu checkout.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-[#c7d2fe] bg-[#eef2ff] p-4 sm:p-5">
        {user ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-indigo-600">Login sebagai</p>
              <p className="font-semibold text-indigo-950">
                {user.name} ({user.email})
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-indigo-400 bg-white px-4 py-2 text-sm font-semibold text-indigo-900 transition hover:bg-indigo-100"
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-lg border px-4 py-1 text-sm font-semibold ${
                  authMode === "login"
                    ? "border-[#6366f1] bg-[#818cf8] text-[#1e1b4b]"
                    : "border-[#818cf8] bg-white text-[#1e1b4b]"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={`rounded-lg border px-4 py-1 text-sm font-semibold ${
                  authMode === "register"
                    ? "border-[#6366f1] bg-[#818cf8] text-[#1e1b4b]"
                    : "border-[#818cf8] bg-white text-[#1e1b4b]"
                }`}
              >
                Register
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {authMode === "register" ? (
                <input
                  type="text"
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Nama"
                  className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-indigo-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              ) : null}

              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="Email"
                className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-indigo-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />

              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Password"
                className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-indigo-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <button
              type="button"
              onClick={handleAuthSubmit}
              disabled={authLoading}
              className="mt-3 rounded-lg border border-indigo-500 bg-indigo-300 px-6 py-2 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {authLoading
                ? "Memproses..."
                : authMode === "login"
                  ? "Login"
                  : "Register"}
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-xl font-bold text-[#1e1b4b]">Products</h3>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                type="text"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Cari judul/author..."
                className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm text-indigo-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <select
                value={productPriceFilter}
                onChange={(event) =>
                  setProductPriceFilter(event.target.value as ProductPriceFilter)
                }
                className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm text-indigo-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="all">Semua harga</option>
                <option value="under_180k">Di bawah 180rb</option>
                <option value="180k_to_200k">180rb - 200rb</option>
                <option value="over_200k">Di atas 200rb</option>
              </select>
              <select
                value={productSort}
                onChange={(event) => setProductSort(event.target.value as ProductSort)}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm text-indigo-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="latest">Terbaru</option>
                <option value="title_asc">Judul A-Z</option>
                <option value="price_low">Harga termurah</option>
                <option value="price_high">Harga termahal</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedNovels.map((book) => (
              <article
                key={book.id}
                className="rounded-xl border border-indigo-200 bg-white p-4 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative mb-3 h-[400px] w-full overflow-hidden rounded-lg border border-[#c7d2fe] bg-[#eef2ff]">
                  <Image
                    src={book.coverImage}
                    alt={`Cover ${book.title}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <h4 className="line-clamp-2 text-sm font-bold text-[#1e1b4b]">
                  {book.title}
                </h4>
                <p className="mt-1 text-xs text-[#4338ca]">{book.author}</p>
                {reviewStats[book.id] ? (
                  <p className="mt-1 text-xs font-semibold text-indigo-700">
                    ⭐ {reviewStats[book.id].averageRating.toFixed(1)} / 5 (
                    {reviewStats[book.id].reviewCount} review)
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-indigo-500">Belum ada review</p>
                )}
                <p className="mt-2 text-xs text-[#1e1b4b]">{book.description}</p>
                <p className="mt-3 text-sm font-semibold text-[#3730a3]">
                  USD {book.priceUsd.toFixed(2)}
                </p>
                <p className="text-xs text-[#4338ca]">
                  Rp {book.priceIdr.toLocaleString("id-ID")}
                </p>
                <button
                  type="button"
                  onClick={() => addToCart(book.id)}
                  className="mt-3 w-full rounded-lg border border-indigo-500 bg-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-400"
                >
                  Add to Cart
                </button>
              </article>
            ))}
          </div>
          {displayedNovels.length === 0 ? (
            <p className="mt-3 rounded-lg border border-indigo-200 bg-white px-4 py-3 text-sm text-indigo-700">
              Tidak ada produk yang cocok dengan pencarian/filter kamu.
            </p>
          ) : null}
          {filteredNovels.length > PRODUCTS_PER_PAGE ? (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-indigo-200 bg-white px-4 py-3 text-sm text-indigo-800">
              <p>
                Halaman {productPage} dari {totalProductPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProductPage((prev) => Math.max(1, prev - 1))}
                  disabled={productPage <= 1}
                  className="rounded-md border border-indigo-300 px-3 py-1 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProductPage((prev) => Math.min(totalProductPages, prev + 1))
                  }
                  disabled={productPage >= totalProductPages}
                  className="rounded-md border border-indigo-300 px-3 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="h-fit rounded-xl border border-indigo-200 bg-white/95 p-4 shadow-md lg:sticky lg:top-6">
          <h3 className="text-xl font-bold text-[#1e1b4b]">Cart ({cartItemCount})</h3>
          <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs font-semibold text-indigo-900">Solana Wallet (X402 / PYUSD)</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void connectWallet()}
                disabled={connectingWallet}
                className="rounded-lg border border-indigo-500 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-900 transition hover:bg-indigo-100 disabled:opacity-60"
              >
                {connectingWallet ? "Connecting..." : "Connect Wallet"}
              </button>
              <button
                type="button"
                onClick={openWalletScan}
                className="rounded-lg border border-indigo-400 bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-900 transition hover:bg-indigo-200"
              >
                Open in Phantom (Scan)
              </button>
              {walletAddress ? (
                <p className="text-xs text-indigo-700">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                </p>
              ) : (
                <p className="text-xs text-indigo-700">Belum terkoneksi</p>
              )}
            </div>
            {walletError ? <p className="mt-1 text-xs text-red-600">{walletError}</p> : null}
            {showWalletScan && walletScanUrl ? (
              <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-2">
                <p className="text-[11px] text-indigo-700">
                  Scan pakai HP untuk buka store di Phantom mobile, lalu connect wallet di
                  sana. Ini tidak menghubungkan sesi desktop secara langsung.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    walletScanUrl,
                  )}`}
                  alt="QR connect wallet mobile"
                  className="mt-2 h-36 w-36 rounded border border-indigo-200 bg-white p-1"
                />
                <div className="mt-2 flex gap-2">
                  <a
                    href={walletScanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800"
                  >
                    Buka Phantom Link
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowWalletScan(false)}
                    className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-xs font-semibold text-indigo-800"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {cartDetailed.length === 0 ? (
            <p className="mt-3 text-sm text-[#4338ca]">Cart masih kosong.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {cartDetailed.map((item) => {
                const isProcessing = processingCartBookId === item.bookId;
                return (
                  <div key={item.bookId} className="rounded-lg border border-[#c7d2fe] p-3">
                    <p className="text-sm font-semibold text-[#1e1b4b]">{item.book.title}</p>
                    <p className="text-xs text-[#4338ca]">{item.book.author}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.bookId, item.quantity - 1)}
                        className="h-7 w-7 rounded border border-indigo-300 text-sm text-indigo-900 transition hover:bg-indigo-100"
                      >
                        -
                      </button>
                      <span className="min-w-7 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.bookId, item.quantity + 1)}
                        className="h-7 w-7 rounded border border-indigo-300 text-sm text-indigo-900 transition hover:bg-indigo-100"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.bookId)}
                        className="ml-auto text-xs text-[#4338ca] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#3730a3]">
                      USD {item.totalUsd.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#4338ca]">
                      Rp {item.totalIdr.toLocaleString("id-ID")}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={!user || isProcessing || loadingMethod !== null}
                        onClick={() =>
                          startCheckout("paypal", {
                            bookId: item.bookId,
                            quantity: item.quantity,
                          })
                        }
                        className="rounded-lg border border-indigo-400 bg-indigo-900 px-2 py-2 text-xs font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-60"
                      >
                        {loadingMethod === "paypal" && isProcessing
                          ? "Processing..."
                          : "PayPal"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          !user ||
                          isProcessing ||
                          loadingMethod !== null ||
                          !walletAddress
                        }
                        onClick={() =>
                          startCheckout("pyusd", {
                            bookId: item.bookId,
                            quantity: item.quantity,
                          })
                        }
                        className="rounded-lg border border-indigo-500 bg-indigo-200 px-2 py-2 text-xs font-semibold text-indigo-950 transition hover:bg-indigo-300 disabled:opacity-60"
                      >
                        {loadingMethod === "pyusd" && isProcessing
                          ? "Processing..."
                          : "X402"}
                      </button>
                      <button
                        type="button"
                        disabled={!user || isProcessing || loadingMethod !== null}
                        onClick={() =>
                          startCheckout("midtrans", {
                            bookId: item.bookId,
                            quantity: item.quantity,
                          })
                        }
                        className="rounded-lg border border-indigo-500 bg-indigo-300 px-2 py-2 text-xs font-semibold text-indigo-950 transition hover:bg-indigo-400 disabled:opacity-60"
                      >
                        {loadingMethod === "midtrans" && isProcessing
                          ? "Processing..."
                          : "Midtrans"}
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-lg border border-[#c7d2fe] bg-[#eef2ff] p-3">
                <p className="text-sm font-semibold text-[#1e1b4b]">
                  Subtotal ({cartItemCount} item):
                </p>
                <p className="text-lg font-bold text-[#3730a3]">
                  USD {cartSubtotalUsd.toFixed(2)}
                </p>
                <p className="text-sm text-[#4338ca]">
                  Rp {cartSubtotalIdr.toLocaleString("id-ID")}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={
                      !user ||
                      cart.length === 0 ||
                      loadingMethod !== null ||
                      processingCartBookId !== null
                    }
                    onClick={() => void startCartCheckout("paypal")}
                    className="rounded-lg border border-indigo-400 bg-indigo-900 px-2 py-2 text-xs font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-60"
                  >
                    {loadingMethod === "paypal" &&
                    processingCartBookId === CART_BULK_PROCESSING_KEY
                      ? "Processing..."
                      : "Checkout All PayPal"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !user ||
                      cart.length === 0 ||
                      loadingMethod !== null ||
                      processingCartBookId !== null ||
                      !walletAddress
                    }
                    onClick={() => void startCartCheckout("pyusd")}
                    className="rounded-lg border border-indigo-500 bg-indigo-200 px-2 py-2 text-xs font-semibold text-indigo-950 transition hover:bg-indigo-300 disabled:opacity-60"
                  >
                    {loadingMethod === "pyusd" &&
                    processingCartBookId === CART_BULK_PROCESSING_KEY
                      ? "Processing..."
                      : "Checkout All X402"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !user ||
                      cart.length === 0 ||
                      loadingMethod !== null ||
                      processingCartBookId !== null
                    }
                    onClick={() => void startCartCheckout("midtrans")}
                    className="rounded-lg border border-indigo-500 bg-indigo-300 px-2 py-2 text-xs font-semibold text-indigo-950 transition hover:bg-indigo-400 disabled:opacity-60"
                  >
                    {loadingMethod === "midtrans" &&
                    processingCartBookId === CART_BULK_PROCESSING_KEY
                      ? "Processing..."
                      : "Checkout All Midtrans"}
                  </button>
                </div>
                {!user ? (
                  <p className="mt-2 text-xs text-[#3730a3]">
                    Login dulu untuk checkout.
                  </p>
                ) : null}
                {user && !walletAddress ? (
                  <p className="mt-2 text-xs text-[#3730a3]">
                    Connect wallet untuk mengaktifkan checkout X402 (PYUSD).
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-6 rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-4">
        <h4 className="text-sm font-semibold text-[#1e1b4b]">Buyer Details</h4>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Nama pembeli"
            className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-indigo-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <input
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="Email pembeli"
            className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-indigo-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-8 rounded-2xl border border-[#c7d2fe] bg-[#eef2ff] p-5 text-indigo-950">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">Riwayat Order</h3>
          {user ? (
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1 text-xs font-semibold transition hover:bg-indigo-100"
            >
              Refresh
            </button>
          ) : null}
        </div>

        {!user ? (
          <p className="text-sm text-indigo-600">Login dulu untuk melihat order.</p>
        ) : ordersLoading ? (
          <p className="text-sm text-indigo-600">Memuat order...</p>
        ) : groupedOrders.length === 0 ? (
          <p className="text-sm text-indigo-600">Belum ada order.</p>
        ) : (
          <ul className="space-y-2">
            {latestGroupedOrders.map((group) => (
              <li
                key={`${group.paymentMethod}:${group.paymentReference}`}
                className="rounded-lg border border-[#c7d2fe] bg-white p-3 text-sm"
              >
                <p className="font-semibold">
                  {group.paymentMethod === "pyusd"
                    ? "X402 (PYUSD)"
                    : group.paymentMethod.toUpperCase()}{" "}
                  • {group.status}
                </p>
                <p>
                  Qty {group.totalQty} • USD {group.totalUsd.toFixed(2)} • Rp{" "}
                  {group.totalIdr.toLocaleString("id-ID")}
                </p>
                <p>Ref: {group.paymentReference}</p>

                {group.items[0] ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/orders/${group.items[0].id}`}
                      className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 transition hover:border-indigo-400 hover:bg-indigo-100"
                    >
                      Lihat Detail Order
                    </Link>
                    {group.status === "pending_payment" ? (
                      <button
                        type="button"
                        onClick={() => void resumePendingPayment(group.items[0])}
                        disabled={resumingOrderId === group.items[0].id}
                        className="inline-flex items-center rounded-md border border-indigo-400 bg-indigo-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-60"
                      >
                        {resumingOrderId === group.items[0].id
                          ? "Mempersiapkan..."
                          : "Lanjut Bayar"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-2 space-y-2">
                  {group.items.map((order) => (
                    <div key={order.id} className="rounded border border-[#c7d2fe] p-2">
                      <p className="font-medium">{order.title}</p>
                      <p className="text-xs text-[#4338ca]">Qty {order.quantity}</p>
                      {order.status === "paid" && order.ebookDriveUrl ? (
                        <a
                          href={order.ebookDriveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block rounded-lg border border-[#6366f1] bg-[#a5b4fc] px-3 py-1 text-xs font-semibold text-[#1e1b4b]"
                        >
                          Akses eBook (Google Drive)
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {groupedOrders.length > 5 ? (
          <p className="mt-3 text-xs text-indigo-600">
            Menampilkan 5 transaksi terakhir.
          </p>
        ) : null}
      </div>
    </section>
  );
}
