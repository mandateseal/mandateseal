import { describe, expect, it } from "vitest";
import { buildRoot, buildProof, verifyProof, leafHash } from "./merkle";

const HASHES = [
  "0000000000000000000000000000000000000000000000000000000000000001",
  "0000000000000000000000000000000000000000000000000000000000000002",
  "0000000000000000000000000000000000000000000000000000000000000003",
  "0000000000000000000000000000000000000000000000000000000000000004",
  "0000000000000000000000000000000000000000000000000000000000000005",
];

describe("merkle.buildRoot", () => {
  it("empty list → zero root", () => {
    expect(buildRoot([])).toBe("0".repeat(64));
  });

  it("single leaf → leafHash of that leaf", () => {
    expect(buildRoot([HASHES[0]])).toBe(leafHash(HASHES[0]));
  });

  it("two leaves → deterministic combined root", () => {
    const r1 = buildRoot([HASHES[0], HASHES[1]]);
    const r2 = buildRoot([HASHES[0], HASHES[1]]);
    expect(r1).toBe(r2);
    expect(r1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changing any leaf changes the root", () => {
    const r1 = buildRoot(HASHES);
    const tampered = [...HASHES];
    tampered[2] = "ff".repeat(32);
    const r2 = buildRoot(tampered);
    expect(r1).not.toBe(r2);
  });

  it("order of leaves matters (we're not building a sorted set)", () => {
    const r1 = buildRoot([HASHES[0], HASHES[1], HASHES[2]]);
    const r2 = buildRoot([HASHES[2], HASHES[1], HASHES[0]]);
    expect(r1).not.toBe(r2);
  });
});

describe("merkle.buildProof + verifyProof roundtrip", () => {
  it("verifies every leaf in a 5-leaf tree", () => {
    const root = buildRoot(HASHES);
    for (let i = 0; i < HASHES.length; i++) {
      const proof = buildProof(HASHES, i);
      expect(verifyProof(HASHES[i], proof, root)).toBe(true);
    }
  });

  it("verifies a single-leaf tree (proof is empty)", () => {
    const root = buildRoot([HASHES[0]]);
    const proof = buildProof([HASHES[0]], 0);
    expect(proof.length).toBe(0);
    expect(verifyProof(HASHES[0], proof, root)).toBe(true);
  });

  it("verifies an odd-sized tree (duplicate-last rule)", () => {
    const odd = HASHES.slice(0, 3);
    const root = buildRoot(odd);
    for (let i = 0; i < odd.length; i++) {
      expect(verifyProof(odd[i], buildProof(odd, i), root)).toBe(true);
    }
  });

  it("rejects out-of-range index", () => {
    expect(() => buildProof(HASHES, -1)).toThrow();
    expect(() => buildProof(HASHES, 99)).toThrow();
  });
});

describe("merkle tamper detection", () => {
  const root = buildRoot(HASHES);

  it("wrong leaf hex fails verification", () => {
    const proof = buildProof(HASHES, 2);
    expect(verifyProof(HASHES[3], proof, root)).toBe(false);
  });

  it("tampered proof step fails verification", () => {
    const proof = buildProof(HASHES, 2);
    const tamperedProof = [...proof];
    tamperedProof[0] = "ff".repeat(32);
    expect(verifyProof(HASHES[2], tamperedProof, root)).toBe(false);
  });

  it("wrong root fails verification", () => {
    const proof = buildProof(HASHES, 2);
    expect(verifyProof(HASHES[2], proof, "00".repeat(32))).toBe(false);
  });
});
