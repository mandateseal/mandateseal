"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SiweMessage } from "siwe";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", { credentials: "include" });
      if (!nonceRes.ok) throw new Error(`nonce fetch failed: HTTP ${nonceRes.status}`);
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to MandateSeal admin console.",
        uri: window.location.origin,
        version: "1",
        chainId,
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
      setSigned(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "sign-in failed";
      setError(msg.toLowerCase());
    } finally {
      setBusy(false);
    }
  }

  const step1Done = isConnected;
  const step2Active = isConnected && !signed;
  const step2Done = signed;
  const step3Active = signed;

  return (
    <div className="border border-line bg-ink/95 font-tech text-paper">
      <div className="border-b border-line px-4 py-2.5 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.22em] text-paperMuted">
          &gt; mandateseal auth
        </span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-paperMuted">
          siwe · eip-4361
        </span>
      </div>

      <div className="divide-y divide-line">
        {/* step 1 */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em]">
            <span className={step1Done ? "text-paperMuted" : "text-amber"}>
              [01] connect wallet
            </span>
            <span className={step1Done ? "text-green" : "text-paperMuted"}>
              {step1Done ? "✓" : "○"}
            </span>
          </div>
          <div className="mt-3">
            {step1Done && address ? (
              <div className="flex items-center justify-between gap-3">
                <code className="text-[12px] text-paper">{shortAddr(address)}</code>
                <ConnectButton.Custom>
                  {({ openAccountModal }) => (
                    <button
                      type="button"
                      onClick={openAccountModal}
                      className="text-[10px] uppercase tracking-[0.18em] text-paperMuted hover:text-paper transition"
                    >
                      switch ↗
                    </button>
                  )}
                </ConnectButton.Custom>
              </div>
            ) : (
              <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
            )}
          </div>
        </div>

        {/* step 2 */}
        <div className={`px-4 py-4 ${!isConnected ? "opacity-40" : ""}`}>
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em]">
            <span className={step2Active ? "text-amber" : "text-paperMuted"}>
              [02] sign nonce
            </span>
            <span className={step2Done ? "text-green" : step2Active ? "text-amber" : "text-paperMuted"}>
              {step2Done ? "✓" : busy ? "·" : step2Active ? "●" : "○"}
            </span>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={signIn}
              disabled={!isConnected || busy || signed}
              className="w-full border border-line bg-ink hover:border-amber hover:text-amber disabled:hover:border-line disabled:hover:text-paperMuted disabled:opacity-50 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-paper transition"
            >
              {busy ? "awaiting signature…" : signed ? "signature accepted" : "sign message"}
            </button>
          </div>
        </div>

        {/* step 3 */}
        <button
          type="button"
          onClick={() => {
            if (!step3Active) return;
            router.push(next);
            router.refresh();
          }}
          disabled={!step3Active}
          className={`block w-full text-left px-4 py-4 transition ${
            step3Active
              ? "hover:bg-amber/5 cursor-pointer"
              : "opacity-40 cursor-not-allowed"
          }`}
        >
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em]">
            <span className={step3Active ? "text-amber" : "text-paperMuted"}>
              [03] open console
            </span>
            <span className={step3Active ? "text-amber" : "text-paperMuted"}>
              {step3Active ? "→" : "○"}
            </span>
          </div>
        </button>

        {error && (
          <div className="px-4 py-3 bg-red/5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-red break-words">
              ! {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
