export const DEFAULT_AGENT = {
  id: "agent_atlas_01",
  name: "Atlas-01",
  role: "Autonomous Research Agent",
};

export const DEFAULT_MANDATE = {
  id: "mandate_research_budget_v1",
  name: "research-budget-v1",
  enabled: true,
  dailyBudgetUsd: 25,
  maxCostPerActionUsd: 2,
  approvalThresholdUsd: 5,
  allowedTools: ["web_search", "paid_api_call", "file_reader", "email_draft"],
  blockedTools: ["wallet_transfer", "shell_exec", "private_key_reader"],
  blockedActions: [
    "transfer_usdc",
    "delete_files",
    "execute_shell_command",
    "access_private_keys",
  ],
  approvalRequiredActions: ["send_email", "buy_dataset"],
  allowedDomains: ["api.openai.com", "github.com", "docs.coinbase.com"],
  blockedDomains: ["unknown-wallet.site", "private-keys.local"],
  // v0.2 — wallet mandate defaults. Empty/false so the existing research
  // agent stays non-crypto unless an operator explicitly opts in.
  agentWallet: null as string | null,
  ownerWallet: null as string | null,
  allowedChains: [] as string[],
  allowedTokens: [] as string[],
  allowedContracts: [] as string[],
  blockedContracts: [] as string[],
  blockedRecipients: [] as string[],
  maxTxValueUsd: 0,
  dailyTokenSpendUsd: 0,
  requireApprovalForSwaps: false,
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
