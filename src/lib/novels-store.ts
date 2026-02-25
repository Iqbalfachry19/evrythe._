import "server-only";

import { createSign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NOVELS, type Novel } from "@/lib/novels";

const NOVELS_STORE_PATH =
  process.env.NOVELS_STORE_PATH ?? path.join(process.cwd(), "data", "novels.json");

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID ?? "";
const GOOGLE_SHEETS_PRODUCTS_SHEET = process.env.GOOGLE_SHEETS_PRODUCTS_SHEET ?? "products";
const GOOGLE_TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_COLUMNS_RANGE = "A:H";
const SHEET_HEADER = [
  "id",
  "title",
  "author",
  "description",
  "priceUsd",
  "priceIdr",
  "coverImage",
  "ebookDriveUrl",
];

type NovelInput = {
  title: string;
  author: string;
  description: string;
  priceUsd: number;
  priceIdr: number;
  coverImage: string;
  ebookDriveUrl: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

type SheetRow = {
  rowNumber: number;
  values: string[];
};

let googleTokenCache: TokenCache = null;

export function isGoogleSheetsConfigured() {
  return !!(GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_SHEETS_ID);
}

function ensureStoreDir() {
  mkdirSync(path.dirname(NOVELS_STORE_PATH), { recursive: true });
}

function toStoreRecord(input: unknown): Novel | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const data = input as Record<string, unknown>;
  if (
    typeof data.id !== "string" ||
    typeof data.title !== "string" ||
    typeof data.author !== "string" ||
    typeof data.description !== "string" ||
    typeof data.priceUsd !== "number" ||
    typeof data.priceIdr !== "number" ||
    typeof data.coverImage !== "string" ||
    typeof data.ebookDriveUrl !== "string"
  ) {
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    author: data.author,
    description: data.description,
    priceUsd: data.priceUsd,
    priceIdr: data.priceIdr,
    coverImage: data.coverImage,
    ebookDriveUrl: data.ebookDriveUrl,
  };
}

function readNovelsFromDisk(): Novel[] {
  try {
    const raw = readFileSync(NOVELS_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => toStoreRecord(entry))
      .filter((entry): entry is Novel => entry !== null);
  } catch {
    return [];
  }
}

function writeNovelsToDisk(novels: Novel[]) {
  ensureStoreDir();
  writeFileSync(NOVELS_STORE_PATH, JSON.stringify(novels, null, 2), "utf8");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function ensureInitializedLocal() {
  const fromDisk = readNovelsFromDisk();
  if (fromDisk.length > 0) {
    return fromDisk;
  }

  writeNovelsToDisk(NOVELS);
  return [...NOVELS];
}

function buildNovel(input: NovelInput, existing: Novel[]): Novel {
  const baseId = slugify(input.title) || `novel-${Date.now()}`;
  let nextId = baseId;
  let counter = 1;

  while (existing.some((novel) => novel.id === nextId)) {
    counter += 1;
    nextId = `${baseId}-${counter}`;
  }

  return {
    id: nextId,
    title: input.title.trim(),
    author: input.author.trim(),
    description: input.description.trim(),
    priceUsd: Number(input.priceUsd.toFixed(2)),
    priceIdr: Math.round(input.priceIdr),
    coverImage: input.coverImage.trim(),
    ebookDriveUrl: input.ebookDriveUrl.trim(),
  };
}

function base64UrlEncode(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createGoogleAssertion() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_AUDIENCE,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(GOOGLE_PRIVATE_KEY, "base64url");
  return `${signingInput}.${signature}`;
}

async function getGoogleAccessToken() {
  if (googleTokenCache && googleTokenCache.expiresAt > Date.now() + 30_000) {
    return googleTokenCache.accessToken;
  }

  const assertion = createGoogleAssertion();
  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(GOOGLE_TOKEN_AUDIENCE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google auth gagal: ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  googleTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

function sheetRange(range: string) {
  return `${GOOGLE_SHEETS_PRODUCTS_SHEET}!${range}`;
}

function valuesUrl(range: string) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(range)}`;
}

async function sheetsRequest(
  endpoint: string,
  init?: RequestInit,
  expectedStatus: number[] = [200],
) {
  const token = await getGoogleAccessToken();
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!expectedStatus.includes(response.status)) {
    const text = await response.text();
    throw new Error(`Google Sheets request gagal (${response.status}): ${text}`);
  }

  return response;
}

function rowToNovel(row: string[]): Novel | null {
  const id = (row[0] ?? "").trim();
  const title = (row[1] ?? "").trim();
  const author = (row[2] ?? "").trim();
  const description = (row[3] ?? "").trim();
  const priceUsd = Number(row[4] ?? 0);
  const priceIdr = Number(row[5] ?? 0);
  const coverImage = (row[6] ?? "").trim();
  const ebookDriveUrl = (row[7] ?? "").trim();

  if (!id || !title || !author || !description || !coverImage || !ebookDriveUrl) {
    return null;
  }
  if (!Number.isFinite(priceUsd) || !Number.isFinite(priceIdr) || priceUsd <= 0 || priceIdr <= 0) {
    return null;
  }

  return {
    id,
    title,
    author,
    description,
    priceUsd: Number(priceUsd.toFixed(2)),
    priceIdr: Math.round(priceIdr),
    coverImage,
    ebookDriveUrl,
  };
}

async function readSheetRows() {
  const range = sheetRange(SHEET_COLUMNS_RANGE);
  const url = `${valuesUrl(range)}?majorDimension=ROWS`;
  const response = await sheetsRequest(url);
  const data = (await response.json()) as { values?: string[][] };
  const rows = data.values ?? [];

  const records: SheetRow[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index] ?? [];
    const id = (values[0] ?? "").trim();
    if (!id) {
      continue;
    }
    records.push({
      rowNumber: index + 1,
      values,
    });
  }

  return records;
}

async function ensureSheetHeader() {
  const range = sheetRange("A1:H1");
  await sheetsRequest(
    `${valuesUrl(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [SHEET_HEADER],
      }),
    },
    [200],
  );
}

async function appendSheetRows(rows: string[][]) {
  const range = sheetRange(SHEET_COLUMNS_RANGE);
  await sheetsRequest(
    `${valuesUrl(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: rows,
      }),
    },
    [200],
  );
}

function novelToRow(novel: Novel) {
  return [
    novel.id,
    novel.title,
    novel.author,
    novel.description,
    String(novel.priceUsd),
    String(novel.priceIdr),
    novel.coverImage,
    novel.ebookDriveUrl,
  ];
}

async function getNovelsFromSheets() {
  const rows = await readSheetRows();
  const novels = rows
    .map((row) => rowToNovel(row.values))
    .filter((entry): entry is Novel => entry !== null);

  if (novels.length > 0) {
    return novels;
  }

  await ensureSheetHeader();
  await appendSheetRows(NOVELS.map((novel) => novelToRow(novel)));
  return [...NOVELS];
}

async function updateSheetRow(rowNumber: number, novel: Novel) {
  const range = sheetRange(`A${rowNumber}:H${rowNumber}`);
  await sheetsRequest(
    `${valuesUrl(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [novelToRow(novel)],
      }),
    },
    [200],
  );
}

async function clearSheetRow(rowNumber: number) {
  const range = sheetRange(`A${rowNumber}:H${rowNumber}`);
  await sheetsRequest(
    `${valuesUrl(range)}:clear`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    [200],
  );
}

async function findSheetRowById(bookId: string) {
  const rows = await readSheetRows();
  return rows.find((row) => (row.values[0] ?? "").trim() === bookId) ?? null;
}

export async function getNovels() {
  if (!isGoogleSheetsConfigured()) {
    return ensureInitializedLocal();
  }

  try {
    return await getNovelsFromSheets();
  } catch {
    return ensureInitializedLocal();
  }
}

export async function findNovelById(bookId: string) {
  const novels = await getNovels();
  return novels.find((novel) => novel.id === bookId);
}

export async function addNovel(input: NovelInput) {
  const novels = await getNovels();
  const nextNovel = buildNovel(input, novels);

  if (!isGoogleSheetsConfigured()) {
    const updated = [...novels, nextNovel];
    writeNovelsToDisk(updated);
    return nextNovel;
  }

  await ensureSheetHeader();
  await appendSheetRows([novelToRow(nextNovel)]);
  return nextNovel;
}

export async function updateNovelById(bookId: string, input: NovelInput) {
  const novels = await getNovels();
  const existing = novels.find((novel) => novel.id === bookId);
  if (!existing) {
    return null;
  }

  const nextNovel: Novel = {
    ...existing,
    title: input.title.trim(),
    author: input.author.trim(),
    description: input.description.trim(),
    priceUsd: Number(input.priceUsd.toFixed(2)),
    priceIdr: Math.round(input.priceIdr),
    coverImage: input.coverImage.trim(),
    ebookDriveUrl: input.ebookDriveUrl.trim(),
  };

  if (!isGoogleSheetsConfigured()) {
    const updated = novels.map((novel) => (novel.id === bookId ? nextNovel : novel));
    writeNovelsToDisk(updated);
    return nextNovel;
  }

  const row = await findSheetRowById(bookId);
  if (!row) {
    return null;
  }

  await updateSheetRow(row.rowNumber, nextNovel);
  return nextNovel;
}

export async function deleteNovelById(bookId: string) {
  const novels = await getNovels();
  const exists = novels.some((novel) => novel.id === bookId);
  if (!exists) {
    return false;
  }

  if (!isGoogleSheetsConfigured()) {
    const updated = novels.filter((novel) => novel.id !== bookId);
    writeNovelsToDisk(updated);
    return true;
  }

  const row = await findSheetRowById(bookId);
  if (!row) {
    return false;
  }

  await clearSheetRow(row.rowNumber);
  return true;
}
