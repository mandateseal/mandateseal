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
]);

export const HIGH_RISK_KEYWORDS = [
  "wallet",
  "shell",
  "private_key",
  "delete",
  "transfer",
];
