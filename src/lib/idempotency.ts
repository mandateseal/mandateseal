// MandateSeal — idempotency (replay protection) for /api/check, /api/proxy,
// /api/mcp tools/call.
//
// Pattern: caller sends `Idempotency-Key: <unique-id>` header. Server hashes
// the canonical action + body and stores both on the persisted preflight
// receipt. On a retry with the same (agentId, key):
//   - if requestHash matches  → return the cached receipt; skip evaluator,
//                                skip upstream call, skip outcome seal.
//   - if requestHash differs  → 409 Conflict.
// Uniqueness is enforced at the DB level via the @@unique([agentId, idempotencyKey])
// index — even a racy double-POST cannot create two receipts for one key.

import { sha256Hex } from "./crypto";
import { canonicalize } from "./canonical";

export const IDEMPOTENCY_HEADER = "idempotency-key";

/** Hash the parts of a request that the idempotency check should be sensitive to. */
export function hashRequestPayload(payload: unknown): string {
  return sha256Hex(canonicalize(payload));
}

/** Pull the idempotency key from a Request's headers; case-insensitive. */
export function readIdempotencyKey(req: Request): string | null {
  const v = req.headers.get(IDEMPOTENCY_HEADER) ?? req.headers.get("Idempotency-Key");
  if (!v) return null;
  const trimmed = v.trim();
  // Stripe-style: cap length, reject control chars, require minimum length so
  // operators can't accidentally pass " " and get global aliasing.
  if (trimmed.length < 8 || trimmed.length > 255) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;
  return trimmed;
}

export interface IdempotencyHit<T> {
  status: "hit" | "miss" | "conflict";
  cached?: T;
}

/**
 * Look up an existing receipt by (agentId, key). Returns:
 *   - { status: "miss" }       → no record yet; caller proceeds with normal flow
 *   - { status: "hit",   cached } → request hashes match; reuse the cached receipt
 *   - { status: "conflict" }   → key reused with a different request body
 *
 * The Prisma lookup is in a separate route helper to keep this file Prisma-free.
 */
export function classifyIdempotency<T extends { requestHash: string | null }>(
  existing: T | null,
  incomingRequestHash: string,
): IdempotencyHit<T> {
  if (!existing) return { status: "miss" };
  if (!existing.requestHash) {
    // Legacy row that pre-dates idempotency support. Treat as a miss to avoid
    // accidentally aliasing two unrelated requests.
    return { status: "miss" };
  }
  if (existing.requestHash === incomingRequestHash) {
    return { status: "hit", cached: existing };
  }
  return { status: "conflict" };
}
