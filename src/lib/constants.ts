export const DEFAULT_AGENT = {
  id: "agent_atlas_01",
  name: "Atlas-01",
  role: "Autonomous Research Agent",
};

// Demo addresses used by the seed + simulator presets. Lowercase ASCII hex
// so policy engine's case-insensitive listed() comparison stays predictable.
export const DEMO_AGENT_WALLET = "0xa4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4";
export const DEMO_OWNER_WALLET = "0xfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfb";
export const DEMO_DEX_CONTRACT = "0x1111111111111111111111111111111111111111";
export const DEMO_GOVERNOR_CONTRACT = "0x3333333333333333333333333333333333333333";
export const DEMO_BLOCKED_CONTRACT = "0xbabababababababababababababababababababa";
export const DEMO_BLOCKED_RECIPIENT = "0xdedededededededededededededededededededede";

export const DEFAULT_MANDATE = {
  id: "mandate_research_budget_v1",
  name: "research-budget-v1",
  enabled: true,
  dailyBudgetUsd: 25,
  maxCostPerActionUsd: 2,
  approvalThresholdUsd: 5,
  // v0.2 — added wallet/dex/bridge/governor so the crypto simulator presets
  // get past the allowedTools whitelist; legacy tools stay so non-crypto
  // research actions still pass.
  allowedTools: [
    "web_search",
    "paid_api_call",
    "file_reader",
    "email_draft",
    "wallet",
    "dex",
    "bridge",
    "governor",
  ],
  blockedTools: ["shell_exec", "private_key_reader"],
  // transfer_usdc removed: now controlled via wallet mandate rules
  // (blockedRecipients, allowedTokens, maxTxValueUsd, requireApprovalForTransfers)
  blockedActions: ["delete_files", "execute_shell_command", "access_private_keys"],
  approvalRequiredActions: ["send_email", "buy_dataset"],
  allowedDomains: ["api.openai.com", "github.com", "docs.coinbase.com"],
  blockedDomains: ["unknown-wallet.site", "private-keys.local"],
  // v0.2 — wallet mandate defaults. Tuned so the dashboard simulator and
  // /playground demos produce the full APPROVED / BLOCKED / NEEDS_APPROVAL
  // distribution out of the box.
  agentWallet: DEMO_AGENT_WALLET as string | null,
  ownerWallet: DEMO_OWNER_WALLET as string | null,
  allowedChains: ["base", "base-sepolia"] as string[],
  allowedTokens: ["USDC", "ETH"] as string[],
  allowedContracts: [DEMO_DEX_CONTRACT, DEMO_GOVERNOR_CONTRACT] as string[],
  blockedContracts: [DEMO_BLOCKED_CONTRACT] as string[],
  blockedRecipients: [DEMO_BLOCKED_RECIPIENT] as string[],
  maxTxValueUsd: 200,
  dailyTokenSpendUsd: 500,
  requireApprovalForSwaps: true,
  requireApprovalForTransfers: false,
};

export const HIGH_RISK_TOOLS = new Set([
  "wallet_transfer",
  "shell_exec",
  "private_key_reader",
]);

export const HIGH_RISK_ACTIONS = new Set([
  "transfer_usdc",
  "delete_files",
  "execute_shell_command",
  "access_private_keys",
  "transfer",
  "delete",
  // v0.2 — crypto action types treated as high-risk by default.
  "token_swap",
  "contract_call",
  "token_approval",
  "bridge_transfer",
  "nft_purchase",
]);

export const HIGH_RISK_KEYWORDS = [
  "wallet",
  "shell",
  "private_key",
  "delete",
  "transfer",
  // v0.2.
  "swap",
  "bridge",
  "approval",
];

/**
 * v0.2 — first-class crypto action types. Used by the simulator, playground,
 * docs, and dashboard filters. The policy engine treats unknown action types
 * the same way (just runs the universal rules), so this list is informational
 * for UIs, not a hard whitelist.
 */
export const CRYPTO_ACTION_TYPES = [
  "transfer_usdc",
  "token_swap",
  "contract_call",
  "token_approval",
  "bridge_transfer",
  "nft_purchase",
  "dao_vote",
] as const;

export type CryptoActionType = (typeof CRYPTO_ACTION_TYPES)[number];

/**
 * Selector for `approve(address,uint256)` — used to detect token-approval
 * actions even when actionType isn't explicitly "token_approval".
 */
export const ERC20_APPROVE_SELECTOR = "0x095ea7b3";

/**
 * Max uint256 (≈ "infinite approval"). Any approval amount this large is
 * treated as infinite by the policy engine.
 */
export const MAX_UINT256_STR =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/**
 * Function selectors the policy engine considers "well-known safe" for
 * contract_call. Anything outside this list routes to NEEDS_APPROVAL when
 * the contract is allowed but the selector is unknown.
 */
export const KNOWN_SAFE_SELECTORS = new Set<string>([
  "0xa9059cbb", // ERC20 transfer(address,uint256)
  "0x23b872dd", // ERC20 transferFrom(address,address,uint256)
  "0x095ea7b3", // ERC20 approve(address,uint256)
  "0x70a08231", // ERC20 balanceOf(address)
  "0x18160ddd", // ERC20 totalSupply()
]);
