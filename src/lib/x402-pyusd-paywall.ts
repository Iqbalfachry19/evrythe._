import "server-only";

import { createPaywall, svmPaywall } from "@x402/paywall";
import type { PaywallConfig, PaywallProvider, PaymentRequired } from "@x402/next";
import { getPyusdSolanaConfig } from "@/lib/pyusd-solana";

function shouldRenderPyusd(paymentRequired: PaymentRequired) {
  const mint = getPyusdSolanaConfig().mint;
  return paymentRequired.accepts.some(
    (entry) => entry.network.startsWith("solana:") && entry.asset === mint,
  );
}

export function createPyusdPaywallProvider(
  config: Pick<PaywallConfig, "appName" | "testnet">,
): PaywallProvider {
  const base = createPaywall()
    .withNetwork(svmPaywall)
    .withConfig({
      appName: config.appName,
      testnet: config.testnet,
    })
    .build();

  return {
    generateHtml(paymentRequired, paywallConfig) {
      const html = base.generateHtml(paymentRequired, paywallConfig);
      if (!shouldRenderPyusd(paymentRequired)) {
        return html;
      }

      return html
        .replace(
          '<script type="module">',
          '<script>window.addEventListener("error",function(e){try{const m=String((e&&((e.error&&e.error.message)||e.message))||"");if(m.includes("Cannot redefine property: StacksProvider")){e.preventDefault();return false}}catch{};return true;});</script><script type="module">',
        )
        .replaceAll(" USDC", " PYUSD")
        .replaceAll("usdc", "pyusd")
        .replaceAll("USDC balance", "PYUSD balance")
        .replaceAll("Solana Devnet USDC", "Solana Devnet PYUSD")
        .replaceAll("solana usdc balance", "solana pyusd balance")
        .replaceAll(
          "window.location.href=A",
          "if(window.opener&&window.location.origin===window.opener.location.origin){window.opener.postMessage({type:'x402-payment-success'},window.location.origin)}window.close();window.location.href=A",
        )
        .replace(
          "throw new Error(`Request failed: ${Me.status} ${Me.statusText}`)",
          'throw new Error(`Request failed: ${Me.status} ${Me.statusText} - ${(() => { const h = Me.headers.get("PAYMENT-REQUIRED"); if (!h) return ""; try { const p = JSON.parse(atob(h)); const e = p?.error || ""; if (e === "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds") { return "Wallet pembayar sama dengan signer facilitator (fee payer). Gunakan wallet buyer yang berbeda, dan pakai X402_FACILITATOR_SECRET_KEY khusus backend."; } return e; } catch { return ""; } })() || await Me.text()}`)',
        );
    },
  };
}
