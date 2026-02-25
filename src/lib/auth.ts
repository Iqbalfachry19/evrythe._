import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SESSION_COOKIE_NAME = "evrit_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const AUTH_STORE_PATH =
  process.env.AUTH_STORE_PATH ?? path.join(process.cwd(), "data", "auth-store.json");

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

type SessionRecord = {
  token: string;
  userId: string;
  expiresAt: number;
};

type AuthStore = {
  users: UserRecord[];
  sessions: SessionRecord[];
};

const EMPTY_STORE: AuthStore = {
  users: [],
  sessions: [],
};

function ensureAuthStoreDir() {
  const storeDir = path.dirname(AUTH_STORE_PATH);
  mkdirSync(storeDir, { recursive: true });
}

function readAuthStoreFromDisk(): AuthStore {
  try {
    const raw = readFileSync(AUTH_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthStore>;
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.sessions)) {
      return { ...EMPTY_STORE };
    }

    return {
      users: parsed.users,
      sessions: parsed.sessions,
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

function writeAuthStoreToDisk(store: AuthStore) {
  ensureAuthStoreDir();
  writeFileSync(AUTH_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function getAuthStore(): AuthStore {
  const globalState = globalThis as typeof globalThis & {
    __EVRIT_AUTH_STORE__?: AuthStore;
  };

  if (!globalState.__EVRIT_AUTH_STORE__) {
    globalState.__EVRIT_AUTH_STORE__ = readAuthStoreFromDisk();
  }

  return globalState.__EVRIT_AUTH_STORE__;
}

function persistAuthStore(store: AuthStore) {
  writeAuthStoreToDisk(store);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export function createUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const store = getAuthStore();
  const email = normalizeEmail(input.email);

  const existing = store.users.find((user) => user.email === email);
  if (existing) {
    throw new Error("Email sudah terdaftar.");
  }

  const salt = randomBytes(16).toString("hex");
  const user: UserRecord = {
    id: `user_${randomBytes(8).toString("hex")}`,
    name: input.name.trim(),
    email,
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  persistAuthStore(store);
  return user;
}

export function authenticateUser(emailInput: string, password: string) {
  const store = getAuthStore();
  const email = normalizeEmail(emailInput);

  const user = store.users.find((entry) => entry.email === email);
  if (!user) {
    return null;
  }

  const calculated = Buffer.from(hashPassword(password, user.salt), "hex");
  const stored = Buffer.from(user.passwordHash, "hex");

  if (calculated.length !== stored.length) {
    return null;
  }

  if (!timingSafeEqual(calculated, stored)) {
    return null;
  }

  return user;
}

export function createSession(userId: string) {
  const store = getAuthStore();
  const token = randomBytes(32).toString("hex");
  const now = Date.now();

  // Keep session list compact and remove expired entries before adding a new one.
  store.sessions = store.sessions.filter((session) => session.expiresAt > now);

  const session: SessionRecord = {
    token,
    userId,
    expiresAt: now + SESSION_TTL_MS,
  };

  store.sessions.push(session);
  persistAuthStore(store);
  return session;
}

export function invalidateSession(token: string) {
  const store = getAuthStore();
  store.sessions = store.sessions.filter((session) => session.token !== token);
  persistAuthStore(store);
}

export function getUserBySessionToken(token: string) {
  const store = getAuthStore();
  const session = store.sessions.find((entry) => entry.token === token);

  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    invalidateSession(token);
    return null;
  }

  // Rolling expiration: active users stay logged in for another 7 days.
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  persistAuthStore(store);

  const user = store.users.find((entry) => entry.id === session.userId);
  return user ?? null;
}

export function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export type SafeUser = ReturnType<typeof sanitizeUser>;
