import "server-only";

import {
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
} from "@solana/kit";
import { base58 } from "@scure/base";
import { x402Facilitator } from "@x402/core/facilitator";
import {
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
  SOLANA_TESTNET_CAIP2,
  toFacilitatorSvmSigner,
} from "@x402/svm";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { getPyusdSolanaConfig } from "@/lib/pyusd-solana";
import { getX402NetworkFromCluster } from "@/lib/x402";

function decodeSecretBytes(input: string) {
  const value = input.trim();
  if (!value) {
    return new Uint8Array();
  }

  if (value.startsWith("[")) {
    const parsed = JSON.parse(value) as number[];
    return Uint8Array.from(parsed);
  }

  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    return Uint8Array.from(Buffer.from(value, "hex"));
  }

  try {
    const asBase64 = Uint8Array.from(Buffer.from(value, "base64"));
    if (asBase64.length === 32 || asBase64.length === 64) {
      return asBase64;
    }
  } catch {
    // noop
  }

  return base58.decode(value);
}

function getFacilitatorNetworks() {
  const clusterNetwork = getX402NetworkFromCluster(getPyusdSolanaConfig().cluster);
  const raw = process.env.X402_FACILITATOR_NETWORKS?.trim();
  if (!raw) {
    return Array.from(
      new Set([clusterNetwork, SOLANA_DEVNET_CAIP2, SOLANA_TESTNET_CAIP2, SOLANA_MAINNET_CAIP2]),
    ) as `${string}:${string}`[];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is `${string}:${string}` => entry.includes(":"));
}

let facilitatorPromise: Promise<x402Facilitator> | null = null;

export async function getLocalX402Facilitator() {
  if (!facilitatorPromise) {
    facilitatorPromise = (async () => {
      const secretRaw = process.env.X402_FACILITATOR_SECRET_KEY?.trim() ?? "";
      if (!secretRaw) {
        throw new Error(
          "X402_FACILITATOR_SECRET_KEY belum diisi. Isi private key Solana 32/64 bytes (base58/base64/hex/json array).",
        );
      }

      const secretBytes = decodeSecretBytes(secretRaw);
      let signer;
      if (secretBytes.length === 64) {
        signer = await createKeyPairSignerFromBytes(secretBytes);
      } else if (secretBytes.length === 32) {
        signer = await createKeyPairSignerFromPrivateKeyBytes(secretBytes);
      } else {
        throw new Error(
          `Panjang private key tidak valid (${secretBytes.length} bytes). Gunakan 32 atau 64 bytes.`,
        );
      }

      const svmSigner = toFacilitatorSvmSigner(signer, {
        defaultRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      });
      const facilitator = new x402Facilitator();
      registerExactSvmScheme(facilitator, {
        signer: svmSigner,
        networks: getFacilitatorNetworks(),
      });

      return facilitator;
    })();
  }

  return facilitatorPromise;
}
