// Deterministic canonical JSON.
// Keys sorted alphabetically at every level. Arrays preserve order.
// undefined values omitted. Used as input to hashes so the same logical
// payload always serializes byte-identically.
export function canonicalize(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function canonical(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = canonical(v);
  }
  return out;
}
