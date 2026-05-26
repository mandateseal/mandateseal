import { createHash, createHmac, randomBytes } from "node:crypto";
import { canonicalize } from "./canonical";

function getSigningSecret(): string {
  const s = process.env.MANDATESEAL_SIGNING_SECRET;
  if (!s || s.length < 8) {
    throw new Error(
      "MANDATESEAL_SIGNING_SECRET is not set. Add it to .env (>=8 chars).",
    );
  }
  return s;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashApiKey(key: string): string {
  return sha256Hex(key);
}

export function generateApiKey(): string {
  return "msk_" + randomBytes(24).toString("hex");
}

export function hashCanonical(payload: unknown): string {
  return sha256Hex(canonicalize(payload));
}

export function signHex(payload: unknown): string {
  const data = canonicalize(payload);
  return createHmac("sha256", getSigningSecret()).update(data).digest("hex");
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(10).toString("hex")}`;
}
