import Link from "next/link";

interface Tab {
  href: string;
  label: string;
}

/**
 * Sub-nav strip under a page header. The 6 top-level nav buckets each fan out
 * into 2–4 sibling pages here, so the operator doesn't lose context when
 * switching between e.g. Receipts ↔ Approvals.
 */
export function SectionSubNav({
  group,
  tabs,
  active,
}: {
  group: string;
  tabs: Tab[];
  active: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <span className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted mr-1">
        {group} ·
      </span>
      {tabs.map((t) => {
        const isActive = t.href === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`subnav-tab${isActive ? " subnav-tab-active" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

// Shared sub-nav definitions — single source of truth for the 3 grouped buckets.

export const AGENTS_TABS: Tab[] = [
  { href: "/agents", label: "Agents" },
  { href: "/mandates", label: "Mandates" },
];

export const LOGS_TABS: Tab[] = [
  { href: "/receipts", label: "Receipts" },
  { href: "/approvals", label: "Approvals" },
  { href: "/audit", label: "Audit" },
  { href: "/spend", label: "Spend" },
];

export const INFRA_TABS: Tab[] = [
  { href: "/tools", label: "Tools" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/anchor", label: "Anchor" },
];

/** @deprecated use INFRA_TABS — kept temporarily to ease the rename rollout. */
export const SETTINGS_TABS = INFRA_TABS;
