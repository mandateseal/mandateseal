"use client";

export interface SegmentOption {
  /** URL-param value. `null` means "all" / unset. */
  value: string | null;
  /** Display label. */
  label: string;
  /** Optional state-specific colors. Falls back to neutral. */
  tone?: "neutral" | "approved" | "blocked" | "needs_approval" | "low" | "medium" | "high";
}

/**
 * A row of mutually-exclusive pill buttons used for "decision" and "risk"
 * filters. Better affordance than a native <select> for short low-cardinality
 * choice sets, and lets us tint each option with its semantic status color.
 */
export function SegmentedFilter({
  label,
  options,
  current,
  onChange,
}: {
  label: string;
  options: SegmentOption[];
  /** Current URL-param value (may be undefined/null/'all'). */
  current: string | undefined | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const isActive =
            o.value === null
              ? !current || current === "" || current === "all"
              : current === o.value;
          return (
            <button
              type="button"
              key={o.value ?? "all"}
              onClick={() => onChange(o.value)}
              className={`seg ${isActive ? `seg-active seg-${o.tone ?? "neutral"}` : ""}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
