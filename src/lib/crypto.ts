import { createHash, generateKeyPairSync, KeyObject, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalize } from "./canonical";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Hash raw bytes — used by v0.8 outcome receipts to seal upstream response bodies. */
export function sha256Bytes(buf: ArrayBuffer | Uint8Array): string {
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return createHash("sha256").update(view).digest("hex");
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

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(10).toString("hex")}`;
}

// ─── Ed25519 keypair ──────────────────────────────────────────────────────────
//
// MandateSeal signs every receipt with an Ed25519 private key. The public key
// is exposed at /api/key.pub so any third party can verify a receipt offline.
//
// Key resolution order:
//   1. env MANDATESEAL_PRIVATE_KEY_B64 + MANDATESEAL_PUBLIC_KEY_B64 (base64-PEM)
//   2. local file .mandateseal-keys.json (gitignored) — auto-generated on first
//      run for dev convenience. NEVER deploy this file.
//   3. error
//
// PEM is used as the wire format because Node's crypto API accepts it directly
// and any external verifier can load it without extra encoding.

interface KeyPair {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicKeyPem: string;
}

let cached: KeyPair | null = null;

function loadOrCreateKeys(): KeyPair {
  if (cached) return cached;

  const envPriv = process.env.MANDATESEAL_PRIVATE_KEY_B64;
  const envPub = process.env.MANDATESEAL_PUBLIC_KEY_B64;
  if (envPriv && envPub) {
    const privPem = Buffer.from(envPriv, "base64").toString("utf8");
    const pubPem = Buffer.from(envPub, "base64").toString("utf8");
    cached = {
      privateKey: createPrivateKey(privPem),
      publicKey: createPublicKey(pubPem),
      publicKeyPem: pubPem,
    };
    return cached;
  }

  const keyFile = join(process.cwd(), ".mandateseal-keys.json");
  if (existsSync(keyFile)) {
    const j = JSON.parse(readFileSync(keyFile, "utf8")) as {
      privateKeyPem: string;
      publicKeyPem: string;
    };
    cached = {
      privateKey: createPrivateKey(j.privateKeyPem),
      publicKey: createPublicKey(j.publicKeyPem),
      publicKeyPem: j.publicKeyPem,
    };
    return cached;
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  writeFileSync(
    keyFile,
    JSON.stringify({ privateKeyPem: privPem, publicKeyPem: pubPem }, null, 2),
    { mode: 0o600 },
  );
  console.warn(
    "[MandateSeal] generated Ed25519 keypair → .mandateseal-keys.json (dev only).\n" +
      "  For production, set MANDATESEAL_PRIVATE_KEY_B64 and MANDATESEAL_PUBLIC_KEY_B64 in env.",
  );
  cached = { privateKey, publicKey, publicKeyPem: pubPem };
  return cached;
}

export function getPublicKeyPem(): string {
  return loadOrCreateKeys().publicKeyPem;
}

/** Sign canonical(payload) with the active Ed25519 private key. Returns base64. */
export function signReceipt(payload: unknown): string {
  const data = Buffer.from(canonicalize(payload), "utf8");
  const sig = cryptoSign(null, data, loadOrCreateKeys().privateKey);
  return sig.toString("base64");
}

/** Verify a base64 signature against canonical(payload) using the active public key. */
export function verifyReceipt(payload: unknown, signatureB64: string): boolean {
  try {
    const data = Buffer.from(canonicalize(payload), "utf8");
    const sig = Buffer.from(signatureB64, "base64");
    return cryptoVerify(null, data, loadOrCreateKeys().publicKey, sig);
  } catch {
    return false;
  }
}

/** Verify against an externally supplied PEM public key (third-party verification). */
export function verifyWithPublicKey(payload: unknown, signatureB64: string, publicKeyPem: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    const data = Buffer.from(canonicalize(payload), "utf8");
    const sig = Buffer.from(signatureB64, "base64");
    return cryptoVerify(null, data, key, sig);
  } catch {
    return false;
  }
}
