// MandateSeal onchain anchor broadcast — v0.9.1.
//
// Sends each AnchorBatch's merkle root to a public chain (Base or Base Sepolia
// by default) as the calldata of a 0-value self-transfer from a server-side
// signer wallet. No smart contract needed — the tx itself is the record.
//
// Calldata format (72 bytes):
//   [0..4)   magic "MS01" (0x4d533031)
//   [4..8)   uint32 batchIndex (big-endian)
//   [8..40)  prevRoot (32 bytes)
//   [40..72) root (32 bytes)
//
// To verify onchain, fetch the tx by hash, slice the input, and compare bytes
// against the batch row in the DB.

import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

export const ANCHOR_MAGIC = "4d533031"; // "MS01"

export interface AnchorConfig {
  chain: typeof base | typeof baseSepolia;
  chainSlug: "base" | "base-sepolia";
  rpcUrl: string;
  privateKey: Hex;
}

export function getAnchorConfig(): AnchorConfig | null {
  const slug = (process.env.MANDATESEAL_ANCHOR_CHAIN ?? "").toLowerCase();
  const rpcUrl = process.env.MANDATESEAL_ANCHOR_RPC_URL ?? "";
  const privateKey = process.env.MANDATESEAL_ANCHOR_PRIVATE_KEY ?? "";
  if (!slug || !rpcUrl || !privateKey) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) return null;
  if (slug === "base") {
    return { chain: base, chainSlug: "base", rpcUrl, privateKey: privateKey as Hex };
  }
  if (slug === "base-sepolia") {
    return { chain: baseSepolia, chainSlug: "base-sepolia", rpcUrl, privateKey: privateKey as Hex };
  }
  return null;
}

export function isAnchorConfigured(): boolean {
  return getAnchorConfig() !== null;
}

function stripHex(s: string): string {
  return s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
}

function uint32ToHex(n: number): string {
  if (n < 0 || n > 0xffffffff) throw new Error(`batchIndex out of uint32 range: ${n}`);
  return n.toString(16).padStart(8, "0");
}

export function encodeAnchorCalldata(args: {
  batchIndex: number;
  prevRoot: string;
  root: string;
}): Hex {
  const prev = stripHex(args.prevRoot).toLowerCase();
  const root = stripHex(args.root).toLowerCase();
  if (prev.length !== 64) throw new Error(`prevRoot must be 32 bytes hex (64 chars), got ${prev.length}`);
  if (root.length !== 64) throw new Error(`root must be 32 bytes hex (64 chars), got ${root.length}`);
  return `0x${ANCHOR_MAGIC}${uint32ToHex(args.batchIndex)}${prev}${root}` as Hex;
}

export function decodeAnchorCalldata(input: string): {
  batchIndex: number;
  prevRoot: string;
  root: string;
} | null {
  const hex = stripHex(input).toLowerCase();
  if (hex.length !== 144) return null;
  if (hex.slice(0, 8) !== ANCHOR_MAGIC) return null;
  const batchIndex = parseInt(hex.slice(8, 16), 16);
  const prevRoot = hex.slice(16, 80);
  const root = hex.slice(80, 144);
  return { batchIndex, prevRoot, root };
}

export interface BroadcastResult {
  txHash: string;
  blockNumber: number;
  chain: "base" | "base-sepolia";
}

export async function broadcastAnchor(args: {
  batchIndex: number;
  prevRoot: string;
  root: string;
}): Promise<BroadcastResult> {
  const cfg = getAnchorConfig();
  if (!cfg) throw new Error("Onchain anchor not configured — set MANDATESEAL_ANCHOR_CHAIN, MANDATESEAL_ANCHOR_RPC_URL, MANDATESEAL_ANCHOR_PRIVATE_KEY");

  const account = privateKeyToAccount(cfg.privateKey);
  const wallet = createWalletClient({ account, chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });

  const data = encodeAnchorCalldata(args);
  const txHash = await wallet.sendTransaction({
    to: account.address,
    value: 0n,
    data,
  });

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    blockNumber: Number(receipt.blockNumber),
    chain: cfg.chainSlug,
  };
}

/**
 * Fetch a previously broadcast anchor tx and decode its calldata.
 * Returns null if the tx isn't found, hasn't confirmed, or doesn't match
 * the MS01 magic.
 */
export async function fetchAnchor(txHash: string): Promise<{
  batchIndex: number;
  prevRoot: string;
  root: string;
  blockNumber: number;
  chain: "base" | "base-sepolia";
  from: string;
} | null> {
  const cfg = getAnchorConfig();
  if (!cfg) throw new Error("Onchain anchor not configured");

  const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const tx = await pub.getTransaction({ hash: txHash as Hex }).catch(() => null);
  if (!tx) return null;
  if (tx.blockNumber === null || tx.blockNumber === undefined) return null;

  const decoded = decodeAnchorCalldata(tx.input);
  if (!decoded) return null;

  return {
    ...decoded,
    blockNumber: Number(tx.blockNumber),
    chain: cfg.chainSlug,
    from: tx.from,
  };
}

export function explorerTxUrl(chainSlug: string, txHash: string): string {
  if (chainSlug === "base") return `https://basescan.org/tx/${txHash}`;
  if (chainSlug === "base-sepolia") return `https://sepolia.basescan.org/tx/${txHash}`;
  return txHash;
}
