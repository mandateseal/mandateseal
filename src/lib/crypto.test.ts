import { describe, expect, it } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  hashCanonical,
  randomId,
  sha256Hex,
  signReceipt,
  verifyReceipt,
  verifyWithPublicKey,
  getPublicKeyPem,
} from "./crypto";

describe("hashing primitives", () => {
  it("sha256Hex returns 64-char hex", () => {
    const h = sha256Hex("test");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashApiKey is sha256 of the key", () => {
    const key = "msk_test";
    expect(hashApiKey(key)).toBe(sha256Hex(key));
  });

  it("hashCanonical produces same hash for logically equal payloads", () => {
    const h1 = hashCanonical({ a: 1, b: 2 });
    const h2 = hashCanonical({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it("hashCanonical changes when payload changes", () => {
    expect(hashCanonical({ a: 1 })).not.toBe(hashCanonical({ a: 2 }));
  });
});

describe("api key generation", () => {
  it("generateApiKey starts with msk_ and is ~50 chars", () => {
    const k = generateApiKey();
    expect(k).toMatch(/^msk_[0-9a-f]{48}$/);
  });

  it("randomId uses given prefix", () => {
    const id = randomId("agent");
    expect(id).toMatch(/^agent_[0-9a-f]{20}$/);
  });

  it("generateApiKey yields unique values", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).not.toBe(b);
  });
});

describe("Ed25519 sign + verify roundtrip", () => {
  it("signed payload verifies", () => {
    const payload = { id: "rct_x", agentId: "a1", costUsd: 0.02 };
    const sig = signReceipt(payload);
    expect(verifyReceipt(payload, sig)).toBe(true);
  });

  it("signature is base64", () => {
    const sig = signReceipt({ x: 1 });
    expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/);
    // Ed25519 sig = 64 bytes → base64 length 88 (or 86 padded)
    expect(sig.length).toBeGreaterThanOrEqual(86);
    expect(sig.length).toBeLessThanOrEqual(88);
  });

  it("tampered payload fails verification", () => {
    const payload = { id: "rct_x", costUsd: 0.02 };
    const sig = signReceipt(payload);
    expect(verifyReceipt({ id: "rct_x", costUsd: 9.99 }, sig)).toBe(false);
  });

  it("tampered signature fails verification", () => {
    const payload = { id: "rct_x" };
    const sig = signReceipt(payload);
    const tampered = sig.slice(0, -4) + "AAAA";
    expect(verifyReceipt(payload, tampered)).toBe(false);
  });

  it("verifyWithPublicKey accepts the server's exposed public key", () => {
    const pem = getPublicKeyPem();
    const payload = { id: "rct_third_party" };
    const sig = signReceipt(payload);
    expect(verifyWithPublicKey(payload, sig, pem)).toBe(true);
  });

  it("payload key order does not affect verification", () => {
    const sig = signReceipt({ a: 1, b: 2 });
    expect(verifyReceipt({ b: 2, a: 1 }, sig)).toBe(true);
  });
});
