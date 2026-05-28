import { describe, it, expect } from "vitest";
import {
  hashRequestPayload,
  readIdempotencyKey,
  classifyIdempotency,
  IDEMPOTENCY_HEADER,
} from "./idempotency";

describe("hashRequestPayload", () => {
  it("is deterministic — same payload, same hash", () => {
    const a = { agentId: "a1", body: { hello: "world" } };
    expect(hashRequestPayload(a)).toBe(hashRequestPayload(a));
  });

  it("is canonical — key order does not change the hash", () => {
    const a = { b: 2, a: 1, c: 3 };
    const b = { c: 3, a: 1, b: 2 };
    expect(hashRequestPayload(a)).toBe(hashRequestPayload(b));
  });

  it("changes when the payload changes", () => {
    const a = hashRequestPayload({ x: 1 });
    const b = hashRequestPayload({ x: 2 });
    expect(a).not.toBe(b);
  });
});

describe("readIdempotencyKey", () => {
  function req(headers: Record<string, string>): Request {
    return new Request("https://x/", { headers });
  }

  it("reads lowercase header", () => {
    expect(readIdempotencyKey(req({ [IDEMPOTENCY_HEADER]: "01jab12c-de34-f567-0123-456789abcdef" }))).toBe(
      "01jab12c-de34-f567-0123-456789abcdef",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(readIdempotencyKey(req({ [IDEMPOTENCY_HEADER]: "  long-enough-key  " }))).toBe("long-enough-key");
  });

  it("rejects keys under 8 chars (collision risk)", () => {
    expect(readIdempotencyKey(req({ [IDEMPOTENCY_HEADER]: "short" }))).toBeNull();
  });

  it("rejects keys over 255 chars", () => {
    expect(readIdempotencyKey(req({ [IDEMPOTENCY_HEADER]: "x".repeat(256) }))).toBeNull();
  });

  it("rejects keys with DEL (0x7f) control character", () => {
    // NUL (\x00) is rejected by undici before we ever see it — DEL still
    // round-trips through Headers but our regex catches it.
    expect(readIdempotencyKey(req({ [IDEMPOTENCY_HEADER]: "key-with-\x7f-del" }))).toBeNull();
  });

  it("returns null when header missing", () => {
    expect(readIdempotencyKey(req({}))).toBeNull();
  });
});

describe("classifyIdempotency", () => {
  it("miss when there's no existing record", () => {
    const r = classifyIdempotency(null, "hash-x");
    expect(r.status).toBe("miss");
  });

  it("hit when hashes match", () => {
    const r = classifyIdempotency({ requestHash: "hash-x" }, "hash-x");
    expect(r.status).toBe("hit");
    if (r.status === "hit") expect(r.cached?.requestHash).toBe("hash-x");
  });

  it("conflict when hashes differ", () => {
    const r = classifyIdempotency({ requestHash: "hash-x" }, "hash-y");
    expect(r.status).toBe("conflict");
  });

  it("legacy row with null requestHash → miss (avoids accidental alias)", () => {
    const r = classifyIdempotency({ requestHash: null }, "hash-x");
    expect(r.status).toBe("miss");
  });
});
