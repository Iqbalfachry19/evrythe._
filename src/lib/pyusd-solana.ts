import "server-only";

export const DEFAULT_PYUSD_SOLANA_MINT =
  "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM";

export function getPyusdSolanaConfig() {
  return {
    mint: process.env.PYUSD_SOLANA_MINT ?? DEFAULT_PYUSD_SOLANA_MINT,
    merchantWallet: process.env.PYUSD_SOLANA_MERCHANT_WALLET ?? "",
    rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    cluster: process.env.SOLANA_CLUSTER ?? "devnet",
    decimals: Number(process.env.PYUSD_SOLANA_DECIMALS ?? 6),
  };
}

export function buildSolanaPayUrl(input: {
  recipient: string;
  amountUsd: number;
  mint: string;
  reference: string;
  label?: string;
  message?: string;
  cluster?: string;
}) {
  const params = new URLSearchParams();
  params.set("amount", input.amountUsd.toFixed(2));
  params.set("spl-token", input.mint);
  params.set("memo", input.reference);
  params.set("label", input.label ?? "EVRIT Store");
  params.set("message", input.message ?? "PYUSD payment for EVRIT order");
  if (input.cluster) {
    params.set("cluster", input.cluster);
  }

  return `solana:${input.recipient}?${params.toString()}`;
}

export function toRawAmount(amountUsd: number, decimals: number) {
  return Math.round(amountUsd * 10 ** decimals);
}
