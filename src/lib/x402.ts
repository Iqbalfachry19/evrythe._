import "server-only";

import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  withX402,
  x402ResourceServer,
  type Network,
  type PaywallProvider,
  type RouteConfig,
} from "@x402/next";
import {
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
  SOLANA_TESTNET_CAIP2,
} from "@x402/svm";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { findOrderById } from "@/lib/orders";
import { getPyusdSolanaConfig } from "@/lib/pyusd-solana";
import { createPyusdPaywallProvider } from "@/lib/x402-pyusd-paywall";

export function getX402NetworkFromCluster(cluster: string) {
  const normalized = cluster.toLowerCase();
  if (normalized === "mainnet" || normalized === "mainnet-beta") {
    return SOLANA_MAINNET_CAIP2;
  }
  if (normalized === "testnet") {
    return SOLANA_TESTNET_CAIP2;
  }
  return SOLANA_DEVNET_CAIP2;
}

function getOrderIdFromContext(context: {
  adapter: {
    getQueryParam?: (name: string) => string | string[] | undefined;
    getUrl: () => string;
  };
}) {
  const direct = context.adapter.getQueryParam?.("orderId");
  if (typeof direct === "string") {
    return direct;
  }
  if (Array.isArray(direct)) {
    return direct[0] ?? "";
  }

  const url = new URL(context.adapter.getUrl());
  return url.searchParams.get("orderId")?.trim() ?? "";
}

function createX402Server() {
  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL ??
    "http://127.0.0.1:3000/api/x402/facilitator";
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const server = new x402ResourceServer(facilitatorClient);
  const pyusdConfig = getPyusdSolanaConfig();
  const scheme = new ExactSvmScheme().registerMoneyParser(async (amount) => {
    // Force x402 SVM pricing to use PYUSD mint instead of default USDC mint.
    const rawAmount = Math.round(amount * 10 ** pyusdConfig.decimals);
    return {
      asset: pyusdConfig.mint,
      amount: String(rawAmount),
    };
  });

  const networks: Network[] = [
    SOLANA_DEVNET_CAIP2,
    SOLANA_TESTNET_CAIP2,
    SOLANA_MAINNET_CAIP2,
  ];
  networks.forEach((network) => {
    server.register(network, scheme);
  });

  return server;
}

export const x402Server = createX402Server();
let x402Initialized = false;
let x402InitPromise: Promise<void> | null = null;

export async function ensureX402Initialized() {
  if (x402Initialized) {
    return;
  }
  if (!x402InitPromise) {
    x402InitPromise = x402Server.initialize().then(() => {
      x402Initialized = true;
    });
  }
  return x402InitPromise;
}

export function buildX402RouteConfig(): RouteConfig {
  const forcedNetwork = process.env.X402_SOLANA_NETWORK?.trim();
  const preferredNetwork =
    forcedNetwork && forcedNetwork.includes(":")
      ? (forcedNetwork as `${string}:${string}`)
      : getX402NetworkFromCluster(getPyusdSolanaConfig().cluster);
  const networkCandidates = [preferredNetwork];

  return {
    accepts: networkCandidates.map((network) => ({
        scheme: "exact",
        network,
        payTo: getPyusdSolanaConfig().merchantWallet,
        price: async (context) => {
          const orderId = getOrderIdFromContext(context);
          const { mint, decimals } = getPyusdSolanaConfig();

          const order = orderId ? findOrderById(orderId) : null;
          if (!order) {
            return {
              asset: mint,
              amount: String(Math.round(9999 * 10 ** decimals)),
            };
          }

          return {
            asset: mint,
            amount: String(Math.round(order.totalUsd * 10 ** decimals)),
          };
        },
        // Keep PYUSD mint and order reference hints available for x402 clients.
        extra: {
          asset: getPyusdSolanaConfig().mint,
          token: "PYUSD",
        },
      })),
    description: "EVRIT checkout via x402 (PYUSD/Solana)",
    mimeType: "application/json",
    unpaidResponseBody: async (context) => {
      const orderId = getOrderIdFromContext(context);
      return {
        contentType: "application/json",
        body: {
          ok: false,
          orderId,
          message: "Payment required via x402.",
        },
      };
    },
  };
}

export const x402WithPayment = withX402;

export function buildX402Paywall(): PaywallProvider {
  const cluster = getPyusdSolanaConfig().cluster.toLowerCase();
  const isTestnet = cluster !== "mainnet" && cluster !== "mainnet-beta";
  return createPyusdPaywallProvider({
    appName: "EVRIT Store",
    testnet: isTestnet,
  });
}
