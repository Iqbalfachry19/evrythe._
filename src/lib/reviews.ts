import "server-only";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type ReviewRecord = {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  bookId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

type ReviewsStore = {
  reviews: ReviewRecord[];
};

const REVIEWS_STORE_PATH =
  process.env.REVIEWS_STORE_PATH ?? path.join(process.cwd(), "data", "reviews.json");

function ensureStoreDir() {
  mkdirSync(path.dirname(REVIEWS_STORE_PATH), { recursive: true });
}

function readStore(): ReviewsStore {
  try {
    const raw = readFileSync(REVIEWS_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ReviewsStore>;
    if (!Array.isArray(parsed.reviews)) {
      return { reviews: [] };
    }
    return { reviews: parsed.reviews };
  } catch {
    return { reviews: [] };
  }
}

function writeStore(store: ReviewsStore) {
  ensureStoreDir();
  writeFileSync(REVIEWS_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function getStore(): ReviewsStore {
  const globalState = globalThis as typeof globalThis & {
    __EVRIT_REVIEWS_STORE__?: ReviewsStore;
  };

  if (!globalState.__EVRIT_REVIEWS_STORE__) {
    globalState.__EVRIT_REVIEWS_STORE__ = readStore();
  }

  return globalState.__EVRIT_REVIEWS_STORE__;
}

function persistStore() {
  writeStore(getStore());
}

export function getReviewByOrderForUser(orderId: string, userId: string) {
  const store = getStore();
  return (
    store.reviews.find(
      (review) => review.orderId === orderId && review.userId === userId,
    ) ?? null
  );
}

export function upsertReview(input: {
  orderId: string;
  userId: string;
  userName: string;
  bookId: string;
  rating: number;
  comment: string;
}) {
  const store = getStore();
  const now = new Date().toISOString();
  const existing = store.reviews.find(
    (review) => review.orderId === input.orderId && review.userId === input.userId,
  );

  if (existing) {
    existing.rating = input.rating;
    existing.comment = input.comment.trim();
    existing.updatedAt = now;
    persistStore();
    return existing;
  }

  const review: ReviewRecord = {
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId: input.orderId,
    userId: input.userId,
    userName: input.userName,
    bookId: input.bookId,
    rating: input.rating,
    comment: input.comment.trim(),
    createdAt: now,
    updatedAt: now,
  };

  store.reviews.unshift(review);
  persistStore();
  return review;
}

export function listReviewsByBook(bookId: string) {
  const store = getStore();
  return store.reviews
    .filter((review) => review.bookId === bookId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getReviewStatsByBook() {
  const store = getStore();
  const grouped = new Map<string, { total: number; count: number }>();

  store.reviews.forEach((review) => {
    const current = grouped.get(review.bookId) ?? { total: 0, count: 0 };
    current.total += review.rating;
    current.count += 1;
    grouped.set(review.bookId, current);
  });

  const result: Record<string, { averageRating: number; reviewCount: number }> = {};
  grouped.forEach((value, bookId) => {
    result[bookId] = {
      averageRating: Number((value.total / value.count).toFixed(2)),
      reviewCount: value.count,
    };
  });
  return result;
}
