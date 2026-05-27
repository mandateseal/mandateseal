import { createHash } from "node:crypto";

// Deterministic SHA-256 merkle tree over an array of hex-string leaves.
//
// Construction rules (compatibility-first — every external verifier should
// be able to reproduce these exactly):
//   • Leaf hash:  sha256( "L:" + utf8(leafHex) )      — domain-separated
//   • Node hash:  sha256( "N:" + sortPair(left, right) )
//   • If odd siblings at a level, the last node is duplicated.
//   • Tree of 0 leaves → empty root "0".repeat(64)
//   • Tree of 1 leaf → root = leafHash of that leaf
//   • Pairs are sorted alphabetically before hashing (commutative concat) —
//     this keeps proofs side-agnostic. The verifier doesn't need an "isLeft"
//     bit per step.

const LEAF_TAG = "L:";
const NODE_TAG = "N:";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function leafHash(leafHex: string): string {
  return sha256Hex(LEAF_TAG + leafHex);
}

function nodeHash(a: string, b: string): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return sha256Hex(NODE_TAG + lo + hi);
}

/** Build the merkle root over an ordered array of leaf hexes. */
export function buildRoot(leafHexes: string[]): string {
  if (leafHexes.length === 0) return "0".repeat(64);
  let layer = leafHexes.map(leafHash);
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left; // duplicate odd
      next.push(nodeHash(left, right));
    }
    layer = next;
  }
  return layer[0];
}

/**
 * Generate a sibling-path proof for `leafHexes[index]`. Proof is an array of
 * sibling hashes from leaf upward. Verifier walks the path, hashing in
 * sort-order at each level.
 */
export function buildProof(leafHexes: string[], index: number): string[] {
  if (index < 0 || index >= leafHexes.length) {
    throw new Error("merkle: index out of range");
  }
  let layer = leafHexes.map(leafHash);
  let i = index;
  const proof: string[] = [];
  while (layer.length > 1) {
    const sibling = i % 2 === 0 ? (i + 1 < layer.length ? layer[i + 1] : layer[i]) : layer[i - 1];
    proof.push(sibling);
    const next: string[] = [];
    for (let j = 0; j < layer.length; j += 2) {
      const left = layer[j];
      const right = j + 1 < layer.length ? layer[j + 1] : left;
      next.push(nodeHash(left, right));
    }
    i = Math.floor(i / 2);
    layer = next;
  }
  return proof;
}

/** Verify a leaf belongs to a root, using the sibling-path proof. */
export function verifyProof(leafHex: string, proof: string[], root: string): boolean {
  let h = leafHash(leafHex);
  for (const sibling of proof) {
    h = nodeHash(h, sibling);
  }
  return h === root;
}
