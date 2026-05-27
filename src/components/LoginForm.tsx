"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SiweMessage } from "siwe";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!address || !chain) return;
    setBusy(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", { credentials: "include" });
      if (!nonceRes.ok) throw new Error(`Nonce fetch failed: HTTP ${nonceRes.status}`);
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to MandateSeal admin console.",
        uri: window.location.origin,
        version: "1",
        chainId: chain.id,
        nonce,
      }).prepareMessage();

      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) {
        const data = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${verifyRes.status}`);
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ink-panel p-5 space-y-4">
      <div>
        <span className="field-label">wallet</span>
        <div className="mt-2">
          <ConnectButton showBalance={false} chainStatus="none" />
        </div>
      </div>

      {isConnected && (
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="command-button accent w-full"
        >
          {busy ? "Awaiting signature…" : "Sign message to continue"}
        </button>
      )}

      {error && (
        <div className="font-tech text-[11px] uppercase tracking-[0.18em] text-red break-words">
          {error}
        </div>
      )}
    </div>
  );
}
