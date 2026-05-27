import Link from "next/link";
import { cookies } from "next/headers";
import { isAuthEnabled, isValidSession, SESSION_COOKIE } from "@/lib/admin-auth";
import { LogoutButton } from "./LogoutButton";

// Primary nav buckets for the operator's daily flow.
// Console: dashboard simulator and live decision.
// Agents: agents and mandates.
// Logs: receipts, approvals, audit, and spend.
// Infra tools stay in a smaller right-side affordance.
const links = [
  { href: "/dashboard", label: "Console" },
  { href: "/agents", label: "Agents" },
  { href: "/receipts", label: "Logs" },
  { href: "/verify", label: "Verify" },
  { href: "/docs", label: "Docs" },
];

export async function NavBar() {
  const authOn = isAuthEnabled();
  const signed = authOn && (await isValidSession(cookies().get(SESSION_COOKIE)?.value));

  return (
    <header className="border-b border-line bg-ink/85 backdrop-blur-sm sticky top-0 z-40">
      <div className="page-container flex items-center justify-between py-3 gap-4">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <img src="/mandateseal-mark.svg" alt="" aria-hidden className="h-6 w-6 shrink-0" />
          <span className="font-display text-paper tracking-[0.16em] text-sm uppercase truncate">
            MandateSeal
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted hover:text-paper px-3 py-2 transition"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href="https://x.com/mandateseal"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 w-7 items-center justify-center border border-line font-tech text-[11px] font-bold text-paperMuted hover:border-paper hover:text-paper transition"
            aria-label="MandateSeal on X"
          >
            X
          </Link>
          <Link
            href="/tools"
            className="font-tech text-[10px] uppercase tracking-[0.22em] text-paperMuted hover:text-paper transition"
            title="Tools / Webhooks / Anchor"
          >
            infra &gt;
          </Link>
          {authOn ? (
            signed ? (
              <LogoutButton />
            ) : (
              <Link
                href="/login"
                className="font-tech text-[10px] uppercase tracking-[0.22em] text-amber hover:text-paper transition"
              >
                sign in
              </Link>
            )
          ) : null}
        </div>
      </div>
    </header>
  );
}
