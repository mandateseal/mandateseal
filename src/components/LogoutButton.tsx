"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={logout}
      disabled={busy}
      className="font-tech text-[10px] uppercase tracking-[0.22em] text-paperMuted hover:text-paper"
    >
      {busy ? "…" : "sign out"}
    </button>
  );
}
