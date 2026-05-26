import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agents", label: "Agents" },
  { href: "/mandates", label: "Mandates" },
  { href: "/receipts", label: "Receipts" },
  { href: "/verify", label: "Verify" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/docs", label: "Docs" },
];

export function NavBar() {
  return (
    <header className="border-b border-line bg-ink/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="page-container flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-3">
          <img src="/mandateseal-mark.svg" alt="" aria-hidden className="h-6 w-6" />
          <span className="font-display text-paper tracking-[0.16em] text-sm uppercase">MandateSeal</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted hover:text-paper px-3 py-2"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="font-tech text-[10px] uppercase tracking-[0.22em] text-paperMuted">
          approve before. prove after.
        </div>
      </div>
    </header>
  );
}
