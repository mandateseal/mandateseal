import { createPublicClient, http } from "viem";
import { prisma } from "./db";

// v0.8.6 — FeeVault entitlement reconciler (the "deposit indexer").
//
// Rather than tail `Deposited` events (cursor state + missed-event risk), we read
// the authoritative on-chain mapping `depositedOf(owner)` from the FeeVault and
// derive prepaid credits from it. Idempotent: granted = f(lifetimeDeposited), so
// re-running always converges to the correct value. consumed (metered usage) is
// never touched here. remaining = granted - consumed (see feegate.ts).
//
// Dark until the vault is deployed + these envs are set; safe no-op otherwise.

export const FEE_GATE_VAULT_ADDRESS = process.env.FEE_GATE_VAULT_ADDRESS ?? "";
export const FEE_GATE_RPC_URL =
  process.env.FEE_GATE_RPC_URL ?? process.env.MANDATESEAL_ANCHOR_RPC_URL ?? "";
/** Credits granted per whole $SEAL deposited. May be < 1 (e.g. 0.001 = 1000 $SEAL/credit). */
export const FEE_GATE_CREDITS_PER_TOKEN = Number(process.env.FEE_GATE_CREDITS_PER_TOKEN ?? 1);
const TOKEN_DECIMALS = 18;

const VAULT_ABI = [
  {
    type: "function",
    name: "depositedOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export function isVaultConfigured(): boolean {
  return (
    /^0x[0-9a-fA-F]{40}$/.test(FEE_GATE_VAULT_ADDRESS) && FEE_GATE_RPC_URL.length > 0
  );
}

/**
 * Pure: lifetime deposited (token base units) → whole prepaid credits.
 * Whole-token granularity (sub-token dust is ignored), so it stays exact for
 * arbitrarily large supplies without floating-point overflow.
 */
export function creditsFromDeposited(
  lifetimeWei: bigint,
  creditsPerToken: number,
  decimals = TOKEN_DECIMALS,
): number {
  if (lifetimeWei <= 0n || creditsPerToken <= 0) return 0;
  const wholeTokens = lifetimeWei / 10n ** BigInt(decimals);
  return Math.floor(Number(wholeTokens) * creditsPerToken);
}

/** Read the authoritative on-chain lifetime deposited for an owner. */
export async function readDepositedOf(ownerWallet: string): Promise<bigint> {
  const pub = createPublicClient({ transport: http(FEE_GATE_RPC_URL) });
  return (await pub.readContract({
    address: FEE_GATE_VAULT_ADDRESS as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "depositedOf",
    args: [ownerWallet as `0x${string}`],
  })) as bigint;
}

/**
 * Reconcile one owner's credits from the on-chain FeeVault. Sets `granted`
 * (consumed is left untouched). Returns the granted credit total. No-op (returns
 * 0) when the vault isn't configured yet.
 */
export async function reconcileEntitlement(ownerWallet: string): Promise<number> {
  if (!isVaultConfigured()) return 0;
  const lifetime = await readDepositedOf(ownerWallet);
  const granted = creditsFromDeposited(lifetime, FEE_GATE_CREDITS_PER_TOKEN);
  const key = ownerWallet.toLowerCase();
  await prisma.entitlement.upsert({
    where: { ownerWallet: key },
    update: { granted },
    create: { ownerWallet: key, granted, consumed: 0 },
  });
  return granted;
}

/**
 * Reconcile every owner with a verified ownerWallet (scheduled refresh / admin
 * trigger). Returns the count of owners reconciled.
 */
export async function reconcileAll(): Promise<number> {
  if (!isVaultConfigured()) return 0;
  const mandates = await prisma.mandate.findMany({
    where: { ownerWalletVerified: true, ownerWallet: { not: null } },
    select: { ownerWallet: true },
  });
  const owners = [...new Set(mandates.map((m) => m.ownerWallet!.toLowerCase()))];
  for (const owner of owners) await reconcileEntitlement(owner);
  return owners.length;
}
