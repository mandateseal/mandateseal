// Deterministic, locale-free date formatting.
// Avoids Next.js hydration mismatches caused by toLocaleString() differing
// between server (Node locale) and client (browser locale).
//
// All MandateSeal timestamps are stored / transmitted as ISO 8601 UTC.
// We display UTC everywhere — audit logs should not silently shift timezones.

export function fmtTimestamp(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}
