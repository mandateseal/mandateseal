// Mainnet-flip preflight for the onchain anchor (roadmap W3).
//
// Read-only — sends NO transaction. Validates the anchor config the server will
// use before you flip MANDATESEAL_ANCHOR_CHAIN to mainnet, so the flip is
// verified, not blind. Mirrors the checks in src/lib/onchain.ts:getAnchorConfig
// plus live RPC + signer-balance checks.
//
// Usage:
//   MANDATESEAL_ANCHOR_CHAIN=base \
//   MANDATESEAL_ANCHOR_RPC_URL=https://mainnet.base.org \
//   MANDATESEAL_ANCHOR_PRIVATE_KEY=0x... \
//     node scripts/anchor-preflight.mjs
//
// Exit code 0 = ready to flip, 1 = at least one blocking failure.

import { createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
let failed = false;
const pass = (m) => console.log(`  ${C.g}✓${C.x} ${m}`);
const warn = (m) => console.log(`  ${C.y}!${C.x} ${m}`);
const fail = (m) => { console.log(`  ${C.r}✗ ${m}${C.x}`); failed = true; };

const EXPECTED = {
  "base": { chain: base, id: 8453, explorer: "https://basescan.org" },
  "base-sepolia": { chain: baseSepolia, id: 84532, explorer: "https://sepolia.basescan.org" },
};
// An anchor tx is a 0-value self-transfer carrying 72 bytes of calldata — cheap
// on Base. This is a soft floor: below it you may only get a handful of anchors.
const MIN_GAS_ETH = 0.0005;

async function main() {
  const slug = (process.env.MANDATESEAL_ANCHOR_CHAIN ?? "").toLowerCase();
  const rpcUrl = process.env.MANDATESEAL_ANCHOR_RPC_URL ?? "";
  const pk = process.env.MANDATESEAL_ANCHOR_PRIVATE_KEY ?? "";

  console.log(`\n${C.b}anchor preflight${C.x}  ${C.d}(read-only — no tx sent)${C.x}\n`);

  // 1. config present
  if (!slug || !rpcUrl || !pk) {
    fail("missing config — set MANDATESEAL_ANCHOR_CHAIN, MANDATESEAL_ANCHOR_RPC_URL, MANDATESEAL_ANCHOR_PRIVATE_KEY");
    return done();
  }
  pass("all three env vars present");

  // 2. slug recognized
  const exp = EXPECTED[slug];
  if (!exp) { fail(`unknown chain "${slug}" — expected "base" or "base-sepolia"`); return done(); }
  pass(`chain slug: ${slug}${slug === "base" ? `  ${C.b}(MAINNET)${C.x}` : "  (testnet)"}`);

  // 3. private key format
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) { fail("MANDATESEAL_ANCHOR_PRIVATE_KEY is not a 0x + 64-hex key"); return done(); }
  pass("private key format OK");

  const account = privateKeyToAccount(pk);
  pass(`signer address: ${account.address}`);

  // 4. RPC reachable + chainId matches the slug
  const pub = createPublicClient({ chain: exp.chain, transport: http(rpcUrl) });
  let chainId;
  try {
    chainId = await pub.getChainId();
  } catch (e) {
    fail(`RPC unreachable at ${rpcUrl} — ${e.shortMessage ?? e.message}`);
    return done();
  }
  if (chainId !== exp.id) {
    fail(`RPC chainId ${chainId} != expected ${exp.id} for "${slug}" — wrong RPC URL for this chain`);
  } else {
    pass(`RPC reachable, chainId ${chainId} matches ${slug}`);
  }

  // 5. signer gas balance
  try {
    const balWei = await pub.getBalance({ address: account.address });
    const balEth = Number(formatEther(balWei));
    if (balWei === 0n) fail(`signer has 0 ETH on ${slug} — fund it before flipping (no gas = no anchor)`);
    else if (balEth < MIN_GAS_ETH) warn(`signer balance ${balEth} ETH is low (< ${MIN_GAS_ETH}) — top up soon`);
    else pass(`signer balance ${balEth} ETH (enough for gas)`);
  } catch (e) {
    fail(`could not read signer balance — ${e.shortMessage ?? e.message}`);
  }

  done(exp);
}

function done(exp) {
  console.log("");
  if (failed) {
    console.log(`${C.r}✗ NOT ready — resolve the failures above before flipping.${C.x}\n`);
    process.exit(1);
  }
  console.log(`${C.g}✓ ready to flip.${C.x} Set the same three vars on Vercel, redeploy, trigger an anchor,`);
  if (exp) console.log(`  then verify the tx at ${exp.explorer}/tx/<hash>.\n`);
  process.exit(0);
}

main().catch((e) => { console.error(`\n${C.r}preflight error:${C.x}`, e.message); process.exit(1); });
