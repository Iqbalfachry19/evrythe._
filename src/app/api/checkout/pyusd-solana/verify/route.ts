import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import {
  bindPyusdSignatureToPaymentReference,
  findOrderByIdForUser,
  updateOrdersPaymentStatus,
} from "@/lib/orders";
import { getPyusdSolanaConfig, toRawAmount } from "@/lib/pyusd-solana";

type VerifyPayload = {
  orderId?: string;
  signature?: string;
};

type RpcResponse = {
  result?: {
    meta?: {
      err?: unknown;
      logMessages?: string[];
      preTokenBalances?: Array<{
        accountIndex?: number;
        mint?: string;
        owner?: string;
        uiTokenAmount?: {
          amount?: string;
        };
      }>;
      postTokenBalances?: Array<{
        accountIndex?: number;
        mint?: string;
        owner?: string;
        uiTokenAmount?: {
          amount?: string;
        };
      }>;
      innerInstructions?: Array<{
        instructions?: Array<{
          parsed?: unknown;
        }>;
      }>;
    };
    transaction?: {
      message?: {
        accountKeys?: Array<
          | string
          | {
              pubkey?: string;
            }
        >;
        instructions?: Array<{
          parsed?: unknown;
        }>;
      };
    };
  } | null;
};

type RpcSignaturesForAddressResponse = {
  result?: Array<{
    signature?: string;
    blockTime?: number;
  }>;
};

type RpcTokenAccountsByOwnerResponse = {
  result?: {
    value?: Array<{
      pubkey?: string;
    }>;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function encodePaymentRequiredHeader(input: {
  amountUsd: number;
  merchantWallet: string;
  mint: string;
  paymentReference: string;
  cluster: string;
}) {
  const payload = {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: `solana:${input.cluster}`,
        maxAmountRequired: input.amountUsd.toFixed(2),
        resource: "/api/checkout/x402/verify",
        description: `Payment for ${input.paymentReference}`,
        mimeType: "application/json",
        payTo: input.merchantWallet,
        asset: input.mint,
        extra: {
          token: "PYUSD",
          paymentReference: input.paymentReference,
          cluster: input.cluster,
        },
      },
    ],
  };

  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

function readSignatureFromX402Headers(request: NextRequest) {
  const raw =
    request.headers.get("payment-signature") ??
    request.headers.get("x-payment") ??
    request.headers.get("x402-payment-signature");
  if (!raw) {
    return "";
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{60,120}$/;
  if (base58Regex.test(trimmed)) {
    return trimmed;
  }

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const direct =
      (typeof parsed.signature === "string" && parsed.signature) ||
      (typeof parsed.txSignature === "string" && parsed.txSignature) ||
      "";
    if (direct && base58Regex.test(direct)) {
      return direct;
    }

    const stack: unknown[] = [parsed];
    while (stack.length > 0) {
      const value = stack.pop();
      if (!value) {
        continue;
      }

      if (typeof value === "string" && base58Regex.test(value)) {
        return value;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => stack.push(item));
        continue;
      }

      if (typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach((item) =>
          stack.push(item),
        );
      }
    }
  } catch {
    return "";
  }

  return "";
}

function getInstructionAmount(info: Record<string, unknown>) {
  const amount = info.amount;
  if (typeof amount === "string" && /^\d+$/.test(amount)) {
    return BigInt(amount);
  }

  const tokenAmount = info.tokenAmount;
  if (tokenAmount && typeof tokenAmount === "object") {
    const raw = (tokenAmount as Record<string, unknown>).amount;
    if (typeof raw === "string" && /^\d+$/.test(raw)) {
      return BigInt(raw);
    }
  }

  return BigInt(0);
}

function collectParsedInstructions(tx: NonNullable<RpcResponse["result"]>) {
  const topLevel = tx.transaction?.message?.instructions ?? [];
  const inner =
    tx.meta?.innerInstructions?.flatMap((entry) => entry.instructions ?? []) ?? [];
  return [...topLevel, ...inner];
}

function getMessageAccountKeyPubkeys(tx: NonNullable<RpcResponse["result"]>) {
  const keys = tx.transaction?.message?.accountKeys ?? [];
  return keys.map((entry) =>
    typeof entry === "string" ? entry : String(entry.pubkey ?? ""),
  );
}

function extractPaymentReferenceCandidates(tx: NonNullable<RpcResponse["result"]>) {
  const candidates = new Set<string>();
  const parsedInstructions = collectParsedInstructions(tx);

  parsedInstructions.forEach((instruction) => {
    const parsed = instruction.parsed;
    if (!parsed) {
      return;
    }

    if (typeof parsed === "string" && parsed.trim()) {
      candidates.add(parsed.trim());
      return;
    }

    if (typeof parsed !== "object") {
      return;
    }

    const parsedRecord = parsed as Record<string, unknown>;
    const directMemo = parsedRecord.memo;
    if (typeof directMemo === "string" && directMemo.trim()) {
      candidates.add(directMemo.trim());
    }

    const info = parsedRecord.info;
    if (info && typeof info === "object") {
      const infoRecord = info as Record<string, unknown>;
      const memo = infoRecord.memo;
      const reference = infoRecord.reference;
      if (typeof memo === "string" && memo.trim()) {
        candidates.add(memo.trim());
      }
      if (typeof reference === "string" && reference.trim()) {
        candidates.add(reference.trim());
      }
    }
  });

  const logs = tx.meta?.logMessages ?? [];
  const memoRegex = /Memo(?:\s*\(len=\d+\))?:\s*(.+)$/i;
  logs.forEach((line) => {
    const match = line.match(memoRegex);
    if (match?.[1]?.trim()) {
      candidates.add(match[1].trim());
    }
  });

  return candidates;
}

async function callSolanaRpc<T>(
  rpcUrl: string,
  body: Record<string, unknown>,
): Promise<T> {
  let lastErrorText = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    lastErrorText = await response.text();
    const isRateLimited = response.status === 429;
    if (isRateLimited && attempt < 2) {
      await sleep(300 * 2 ** attempt);
      continue;
    }

    if (isRateLimited) {
      throw new Error(
        "RPC Solana sedang rate limit (429). Coba lagi sebentar atau pakai RPC dedicated di SOLANA_RPC_URL.",
      );
    }

    throw new Error(`Gagal membaca RPC Solana: ${lastErrorText}`);
  }

  throw new Error(`Gagal membaca RPC Solana: ${lastErrorText}`);
}

function transactionMatchesOrder(input: {
  tx: NonNullable<RpcResponse["result"]>;
  paymentReference: string;
  minimumRawAmount: bigint;
  merchantWallet: string;
  mint: string;
}) {
  const { tx, paymentReference, minimumRawAmount, merchantWallet, mint } = input;
  const paymentReferenceCandidates = extractPaymentReferenceCandidates(tx);
  if (!paymentReferenceCandidates.has(paymentReference)) {
    return false;
  }

  const accountKeys = getMessageAccountKeyPubkeys(tx);
  const postTokenBalances = tx.meta?.postTokenBalances ?? [];
  const preTokenBalances = tx.meta?.preTokenBalances ?? [];
  const merchantTokenAccounts = new Set(
    postTokenBalances
      .filter((entry) => entry.owner === merchantWallet && entry.mint === mint)
      .map((entry) => {
        const index = entry.accountIndex;
        if (typeof index !== "number") {
          return "";
        }
        return accountKeys[index] ?? "";
      })
      .filter(Boolean),
  );

  const instructions = collectParsedInstructions(tx);
  const foundValidTransferByInstruction = instructions.some((instruction) => {
    const parsed = instruction.parsed;
    if (!parsed || typeof parsed !== "object") {
      return false;
    }

    const parsedRecord = parsed as Record<string, unknown>;
    const type = String(parsedRecord.type ?? "");
    if (type !== "transfer" && type !== "transferChecked") {
      return false;
    }

    const info = (parsedRecord.info ?? {}) as Record<string, unknown>;
    const destination = String(info.destination ?? "");
    const parsedMint = String(info.mint ?? "");
    const amountRaw = getInstructionAmount(info);
    const destinationMatches =
      destination === merchantWallet || merchantTokenAccounts.has(destination);
    const mintMatches =
      type === "transferChecked"
        ? parsedMint === mint
        : parsedMint === "" || parsedMint === mint;

    return destinationMatches && mintMatches && amountRaw >= minimumRawAmount;
  });

  const creditedToMerchantRaw = postTokenBalances
    .filter((entry) => entry.owner === merchantWallet && entry.mint === mint)
    .reduce((sum, postEntry) => {
      const accountIndex = postEntry.accountIndex;
      const postRaw = BigInt(postEntry.uiTokenAmount?.amount ?? "0");
      const matchedPre = preTokenBalances.find(
        (preEntry) =>
          preEntry.accountIndex === accountIndex &&
          preEntry.owner === merchantWallet &&
          preEntry.mint === mint,
      );
      const preRaw = BigInt(matchedPre?.uiTokenAmount?.amount ?? "0");
      const delta = postRaw - preRaw;
        return delta > BigInt(0) ? sum + delta : sum;
      }, BigInt(0));

  return foundValidTransferByInstruction || creditedToMerchantRaw >= minimumRawAmount;
}

export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Silakan login dulu." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as VerifyPayload;
    const orderId = body.orderId?.trim() ?? "";
    const signature =
      body.signature?.trim() ?? readSignatureFromX402Headers(request);
    if (!orderId) {
      return NextResponse.json(
        { error: "orderId wajib diisi." },
        { status: 400 },
      );
    }

    const order = findOrderByIdForUser(orderId, user.id);
    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
    }

    if (order.paymentMethod !== "pyusd") {
      return NextResponse.json(
        { error: "Order ini bukan metode PYUSD Solana." },
        { status: 400 },
      );
    }

    if (order.status !== "pending_payment") {
      return NextResponse.json(
        { error: "Order ini tidak dalam status pending payment." },
        { status: 400 },
      );
    }

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

    const minimumRawAmount = BigInt(toRawAmount(order.totalUsd, config.decimals));
    const signaturesToTry = new Set<string>();
    if (signature) {
      signaturesToTry.add(signature);
    } else {
      const tokenAccountsRpc = await callSolanaRpc<RpcTokenAccountsByOwnerResponse>(
        config.rpcUrl,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [config.merchantWallet, { mint: config.mint }, { encoding: "jsonParsed" }],
        },
      );
      const tokenAccounts =
        tokenAccountsRpc.result?.value?.map((entry) => entry.pubkey ?? "").filter(Boolean) ??
        [];
      const addressesToScan = [config.merchantWallet, ...tokenAccounts];

      const discovered: Array<{ signature: string; blockTime: number }> = [];
      for (const address of addressesToScan) {
        const signaturesRpc = await callSolanaRpc<RpcSignaturesForAddressResponse>(
          config.rpcUrl,
          {
            jsonrpc: "2.0",
            id: 1,
            method: "getSignaturesForAddress",
            params: [address, { limit: 8 }],
          },
        );

        (signaturesRpc.result ?? []).forEach((entry) => {
          const sig = entry.signature?.trim() ?? "";
          if (!sig) {
            return;
          }
          discovered.push({ signature: sig, blockTime: entry.blockTime ?? 0 });
        });
      }

      discovered
        .sort((a, b) => b.blockTime - a.blockTime)
        .slice(0, 20)
        .forEach((entry) => signaturesToTry.add(entry.signature));
    }

    let matchedSignature = "";
    for (const sig of signaturesToTry) {
      const txRpc = await callSolanaRpc<RpcResponse>(config.rpcUrl, {
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          sig,
          {
            encoding: "jsonParsed",
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          },
        ],
      });

      const tx = txRpc.result;
      if (!tx || tx.meta?.err) {
        continue;
      }

      const matches = transactionMatchesOrder({
        tx,
        paymentReference: order.paymentReference,
        minimumRawAmount,
        merchantWallet: config.merchantWallet,
        mint: config.mint,
      });
      if (matches) {
        matchedSignature = sig;
        break;
      }
    }

    if (!matchedSignature) {
      const paymentRequired = encodePaymentRequiredHeader({
        amountUsd: order.totalUsd,
        merchantWallet: config.merchantWallet,
        mint: config.mint,
        paymentReference: order.paymentReference,
        cluster: config.cluster,
      });
      return NextResponse.json(
        {
          error:
            "Pembayaran belum ditemukan otomatis. Tunggu konfirmasi network atau masukkan signature transaksi.",
        },
        {
          status: 402,
          headers: {
            "Payment-Required": paymentRequired,
            "X-Payment-Required": paymentRequired,
            "X402-Version": "2",
          },
        },
      );
    }

    const signatureBinding = bindPyusdSignatureToPaymentReference(
      matchedSignature,
      order.paymentReference,
    );
    if (!signatureBinding.ok) {
      return NextResponse.json(
        {
          error:
            "Signature ini sudah digunakan untuk payment reference lain, jadi tidak bisa dipakai ulang.",
        },
        { status: 409 },
      );
    }

    updateOrdersPaymentStatus("pyusd", order.paymentReference, "paid");
    return NextResponse.json({ ok: true, orderId: order.id, signature: matchedSignature });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal verifikasi transaksi Solana.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
