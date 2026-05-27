// MandateSeal TypeScript SDK.
//
//   import { MandateSeal } from "./sdk/mandateseal";
//   const seal = new MandateSeal({ apiKey: process.env.MANDATESEAL_API_KEY!, baseUrl: "http://localhost:3000" });
//   const result = await seal.check({ agentId, actionType, tool, target, costUsd });
//   if (result.decision !== "APPROVED") throw new Error(result.reason);
//
// Receipts are signed with Ed25519. The matching public key is at:
//   GET <baseUrl>/api/key.pub  →  text/x-pem-file
// `verifyOffline` lets you check a receipt without contacting MandateSeal.

export type Decision = "APPROVED" | "BLOCKED" | "NEEDS_APPROVAL";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ActionRequest {
  agentId: string;
  mandateId?: string;
  actionType: string;
  tool: string;
  target: string;
  costUsd: number;
  metadata?: Record<string, unknown>;
  // v0.2 — optional crypto fields. Activate crypto-specific policy rules.
  chain?: string;
  wallet?: string;
  token?: string;
  amount?: string;
  txValueUsd?: number;
  recipient?: string;
  contractAddress?: string;
  functionSelector?: string;
  txHash?: string;
}

export interface Receipt {
  id: string;
  agentId: string;
  mandateId: string;
  actionType: string;
  tool: string;
  target: string;
  costUsd: number;
  decision: Decision;
  reason: string;
  matchedRule: string;
  riskLevel: RiskLevel;
  timestamp: string;
  policyHash: string;
  receiptHash: string;
  signature: string;
  rawPayload?: Record<string, unknown>;
  approval?: Approval | null;
  // v0.2 — crypto fields present on crypto-action receipts.
  chain?: string | null;
  wallet?: string | null;
  token?: string | null;
  amount?: string | null;
  txValueUsd?: number | null;
  recipient?: string | null;
  contractAddress?: string | null;
  functionSelector?: string | null;
  txHash?: string | null;
}

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export interface Approval {
  id: string;
  receiptId: string;
  agentId: string;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  expiresAt: string;
}

export interface CheckResult {
  decision: Decision;
  reason: string;
  matchedRule: string;
  riskLevel: RiskLevel;
  receipt: Receipt;
}

export interface MandateSealConfig {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ReceiptFilter {
  agentId?: string;
  mandateId?: string;
  decision?: Decision;
  riskLevel?: RiskLevel;
  tool?: string;
  actionType?: string;
  from?: string;        // ISO 8601
  to?: string;          // ISO 8601
  costMin?: number;
  costMax?: number;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AnchorBatch {
  id: string;
  batchIndex: number;
  root: string;
  prevRoot: string;
  receiptCount: number;
  startedAt: string;
  endedAt: string;
  chain: string | null;
  txHash: string | null;
  blockNumber: number | null;
  createdAt: string;
}

export type WebhookEvent =
  | "receipt.created"
  | "receipt.blocked"
  | "receipt.needs_approval"
  | "approval.requested"
  | "approval.decided";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  error: string | null;
  signature: string;
  createdAt: string;
  lastTriedAt: string | null;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  kind: string;
  endpoint: string;
  method: string;
  defaultCostUsd: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSpendRow {
  agentId: string;
  agentName: string;
  dailyBudgetUsd: number;
  todayUsd: number;
  weekUsd: number;
  monthUsd: number;
  totalUsd: number;
  todayPctOfBudget: number;
}

export interface AuditStats {
  total: number;
  totalCostUsd: number;
  byDecision: Array<{ decision: string; count: number; costUsd: number }>;
  topTools: Array<{ tool: string; count: number }>;
  topActions: Array<{ actionType: string; count: number }>;
  topMatchedRules: Array<{ rule: string; count: number }>;
  perAgent: Array<{
    agentId: string;
    total: number;
    approved: number;
    blocked: number;
    needsApproval: number;
    totalCostUsd: number;
  }>;
  perMandate: Array<{ mandateId: string; count: number; costUsd: number }>;
}

function buildQS(opts: object | undefined): string {
  if (!opts) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

/** Shape of `MandateSealError.body` when thrown by `guard()`. */
export interface GuardErrorBody {
  decision: Decision;
  matchedRule?: string;
  receipt: Receipt;
  approval?: Approval;
}

export class MandateSealError<B = unknown> extends Error {
  readonly status: number;
  readonly body: B;
  constructor(message: string, status: number, body: B) {
    super(message);
    this.name = "MandateSealError";
    this.status = status;
    this.body = body;
  }
  /** Type guard for narrowing thrown errors from `guard()`. */
  isGuardError(): this is MandateSealError<GuardErrorBody> {
    return (
      typeof this.body === "object" &&
      this.body !== null &&
      "decision" in (this.body as Record<string, unknown>) &&
      "receipt" in (this.body as Record<string, unknown>)
    );
  }
}

export class MandateSeal {
  private apiKey: string;
  private baseUrl: string;
  private fetchImpl: typeof fetch;

  constructor({ apiKey, baseUrl, fetchImpl }: MandateSealConfig) {
    if (!apiKey) throw new Error("MandateSeal: apiKey is required");
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? "http://localhost:3000").replace(/\/+$/, "");
    this.fetchImpl = fetchImpl ?? (globalThis.fetch as typeof fetch);
    if (!this.fetchImpl) {
      throw new Error("MandateSeal: no fetch implementation available (pass fetchImpl)");
    }
  }

  /** Authenticated preflight: returns decision + signed receipt. */
  async check(action: ActionRequest): Promise<CheckResult> {
    return this.request<CheckResult>("/api/check", action, true);
  }

  /** Generate a signed receipt for an action (no auth required in MVP). */
  async createReceipt(action: ActionRequest): Promise<{ receipt: Receipt }> {
    return this.request<{ receipt: Receipt }>("/api/receipts", action, false);
  }

  /** Verify a stored or third-party receipt via the server. */
  async verifyReceipt(
    receipt: Receipt | { id: string },
  ): Promise<{ valid: boolean; reasons: string[]; reEvaluation?: { matched: boolean } }> {
    return this.request<{ valid: boolean; reasons: string[] }>("/api/verify", receipt, false);
  }

  /** Short alias for `verifyReceipt`. */
  verify(receipt: Receipt | { id: string }) {
    return this.verifyReceipt(receipt);
  }

  /** Short alias for `createReceipt` — generates a signed receipt without bearer auth. */
  seal(action: ActionRequest) {
    return this.createReceipt(action);
  }

  /**
   * Guarded execution — the one-line MandateSeal pattern.
   *
   * Calls `/api/check` for the action. Behaviour by decision:
   *   APPROVED        → runs `fn()`, returns its value.
   *   BLOCKED         → throws MandateSealError (status 403).
   *   NEEDS_APPROVAL  → blocks on `waitForApproval()`; if approved, runs `fn()`; otherwise throws.
   *
   * The signed receipt is attached to thrown errors as `.body.receipt`.
   *
   *   const data = await seal.guard(
   *     { agentId, actionType: "paid_api_call", tool: "paid_api_call", target, costUsd: 0.02 },
   *     () => openai.responses.create({ ... }),
   *   );
   */
  async guard<T>(
    action: ActionRequest,
    fn: () => Promise<T> | T,
    opts?: { approvalTimeoutMs?: number },
  ): Promise<{ value: T; receipt: Receipt }> {
    const preflight = await this.check(action);

    if (preflight.decision === "APPROVED") {
      const value = await fn();
      return { value, receipt: preflight.receipt };
    }

    if (preflight.decision === "NEEDS_APPROVAL" && preflight.receipt.approval) {
      const final = await this.waitForApproval(preflight.receipt.approval.id, {
        pollUntilMs: opts?.approvalTimeoutMs,
      });
      if (final.status === "approved") {
        const value = await fn();
        return { value, receipt: preflight.receipt };
      }
      throw new MandateSealError(
        `MandateSeal: action ${final.status}${final.decisionNote ? ` — ${final.decisionNote}` : ""}`,
        403,
        { decision: "NEEDS_APPROVAL", approval: final, receipt: preflight.receipt },
      );
    }

    // BLOCKED, or NEEDS_APPROVAL without approval attached (shouldn't happen).
    throw new MandateSealError(
      `MandateSeal: ${preflight.reason}`,
      403,
      { decision: preflight.decision, matchedRule: preflight.matchedRule, receipt: preflight.receipt },
    );
  }

  /** List receipts with the full filter surface. */
  async listReceipts(opts?: ReceiptFilter): Promise<{
    receipts: Receipt[];
    pagination?: { limit: number; offset: number; total: number; returned: number };
  }> {
    const qs = buildQS(opts);
    const path = "/api/receipts" + (qs ? "?" + qs : "");
    return this.getJson<{
      receipts: Receipt[];
      pagination?: { limit: number; offset: number; total: number; returned: number };
    }>(path);
  }

  /** Roll-up integrity audit — re-verifies every receipt and returns valid/invalid counts. */
  async auditIntegrity(opts?: { agentId?: string; limit?: number }): Promise<{
    scanned: number;
    valid: number;
    invalid: number;
    integrity: number;
    durationMs: number;
    truncated: boolean;
    failures: Array<{ id: string; agentId: string; timestamp: string; reasons: string[] }>;
  }> {
    const qs = buildQS(opts);
    return this.getJson("/api/audit/integrity" + (qs ? "?" + qs : ""));
  }

  /** Aggregate stats — per-decision, per-agent, per-mandate, top tools / actions / rules. */
  async auditStats(opts?: { from?: string; to?: string }): Promise<AuditStats> {
    const qs = buildQS(opts);
    return this.getJson<AuditStats>("/api/audit/stats" + (qs ? "?" + qs : ""));
  }

  /** Per-agent spend across today / 7d / 30d / total + daily-budget utilization. */
  async auditSpend(): Promise<{ agents: AgentSpendRow[] }> {
    return this.getJson<{ agents: AgentSpendRow[] }>("/api/audit/spend");
  }

  /**
   * Wait until a NEEDS_APPROVAL action is resolved by a human (or expires).
   * Long-polls server-side; retries on timeout until `pollUntilMs` is reached.
   * Returns the final Approval object — caller should inspect `.status`.
   */
  async waitForApproval(approvalId: string, opts?: { pollUntilMs?: number }): Promise<Approval> {
    const deadline = Date.now() + (opts?.pollUntilMs ?? 5 * 60_000);
    while (true) {
      const res = await this.fetchImpl(`${this.baseUrl}/api/approvals/${approvalId}/wait?timeoutMs=25000`);
      const data = await safeJson(res);
      if (!res.ok) {
        throw new MandateSealError("waitForApproval failed", res.status, data);
      }
      const a = (data as { approval: Approval }).approval;
      if (a.status !== "pending") return a;
      if (Date.now() >= deadline) return a;
    }
  }

  /** Admin action — approve a pending approval. Requires admin session cookie OR open auth. */
  async approveAction(
    approvalId: string,
    opts?: { decidedBy?: string; decisionNote?: string },
  ): Promise<{ approval: Approval }> {
    return this.request<{ approval: Approval }>(`/api/approvals/${approvalId}/approve`, opts ?? {}, false);
  }

  /** Admin action — deny a pending approval. */
  async denyAction(
    approvalId: string,
    opts?: { decidedBy?: string; decisionNote?: string },
  ): Promise<{ approval: Approval }> {
    return this.request<{ approval: Approval }>(`/api/approvals/${approvalId}/deny`, opts ?? {}, false);
  }

  /** List all registered tools. */
  async listTools(): Promise<{ tools: Tool[] }> {
    return this.getJson<{ tools: Tool[] }>("/api/tools");
  }

  /** Register a new tool. Admin-protected on the server. */
  async registerTool(input: {
    name: string;
    endpoint: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    description?: string;
    defaultCostUsd?: number;
    enabled?: boolean;
  }): Promise<{ tool: Tool }> {
    return this.request<{ tool: Tool }>("/api/tools", input, false);
  }

  /**
   * Invoke a tool through the MandateSeal proxy. Equivalent to:
   *   POST /api/proxy/<toolName>
   *   Authorization: Bearer <apiKey>
   *
   * Returns the upstream response unchanged. Read response headers for the
   * MandateSeal receipt id (`X-MandateSeal-Receipt`) and decision.
   *
   * Throws MandateSealError on 401/403/4xx/5xx — for non-APPROVED decisions
   * the error body carries `{ decision, matchedRule, receipt }`.
   */
  async invokeTool(toolName: string, body: unknown, init?: { headers?: Record<string, string> }): Promise<Response> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/proxy/${encodeURIComponent(toolName)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
        ...(init?.headers ?? {}),
      },
      body: typeof body === "string" || body instanceof ArrayBuffer ? body : JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      throw new MandateSealError(`MandateSeal /api/proxy/${toolName} failed`, res.status, data);
    }
    return res;
  }

  /** List registered webhooks. */
  async listWebhooks(): Promise<{ webhooks: Webhook[] }> {
    return this.getJson<{ webhooks: Webhook[] }>("/api/webhooks");
  }

  /** Register a webhook subscription. */
  async registerWebhook(input: {
    name: string;
    url: string;
    events: WebhookEvent[];
    enabled?: boolean;
  }): Promise<{ webhook: Webhook }> {
    return this.request<{ webhook: Webhook }>("/api/webhooks", input, false);
  }

  /** Recent deliveries for one webhook (newest first). */
  async listWebhookDeliveries(
    webhookId: string,
    opts?: { limit?: number },
  ): Promise<{ deliveries: WebhookDelivery[] }> {
    const qs = buildQS(opts);
    return this.getJson<{ deliveries: WebhookDelivery[] }>(
      `/api/webhooks/${encodeURIComponent(webhookId)}/deliveries${qs ? "?" + qs : ""}`,
    );
  }

  /** List anchor batches (newest first) + count of receipts still unanchored. */
  async listAnchorBatches(): Promise<{ batches: AnchorBatch[]; pendingReceipts: number }> {
    return this.getJson<{ batches: AnchorBatch[]; pendingReceipts: number }>("/api/anchor");
  }

  /** Seal every unanchored receipt into the next merkle batch. */
  async sealAnchor(): Promise<{ batch: AnchorBatch; leafCount: number }> {
    return this.request<{ batch: AnchorBatch; leafCount: number }>("/api/anchor", {}, false);
  }

  /** Fetch a merkle proof for one anchored receipt. */
  async getAnchorProof(receiptId: string): Promise<{
    receiptId: string;
    receiptHash: string;
    batchIndex: number;
    batchId: string;
    root: string;
    prevRoot: string;
    proof: string[];
    leafIndex: number;
  }> {
    return this.getJson(`/api/anchor/proof?receiptId=${encodeURIComponent(receiptId)}`);
  }

  /** Standalone proof verification — no DB. Validates leaf in tree under claimed root. */
  async verifyAnchorProof(input: { receiptHash: string; proof: string[]; root: string }): Promise<{ valid: boolean }> {
    return this.request<{ valid: boolean }>("/api/anchor/verify", input, false);
  }

  /** Re-walk every batch; recompute roots; check prev-root chain. */
  async auditAnchorChain(): Promise<{
    scanned: number;
    valid: number;
    invalid: number;
    failures: Array<{ batchIndex: number; reasons: string[] }>;
  }> {
    return this.getJson("/api/anchor/audit");
  }

  /** Fetch the server's Ed25519 public key (PEM). */
  async getPublicKey(): Promise<string> {
    const res = await this.fetchImpl(this.baseUrl + "/api/key.pub");
    if (!res.ok) throw new MandateSealError("Failed to fetch public key", res.status, null);
    return await res.text();
  }

  private async request<T>(path: string, body: unknown, auth: boolean): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth) headers.authorization = `Bearer ${this.apiKey}`;
    const res = await this.fetchImpl(this.baseUrl + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "error" in (data as Record<string, unknown>)
          ? String((data as Record<string, unknown>).error)
          : `MandateSeal ${path} failed`;
      throw new MandateSealError(msg, res.status, data);
    }
    return data as T;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(this.baseUrl + path);
    const data = await safeJson(res);
    if (!res.ok) {
      throw new MandateSealError(`MandateSeal ${path} failed`, res.status, data);
    }
    return data as T;
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Verify a receipt **offline** with a previously-fetched public key.
 * Node-only (uses `node:crypto`). For browser-side verification, use the WebCrypto
 * variant or call `verifyReceipt` over the network.
 */
export async function verifyOfflineNode(
  receipt: Receipt,
  publicKeyPem: string,
): Promise<{ valid: boolean; reasons: string[] }> {
  const { createPublicKey, createHash, verify } = await import("node:crypto");
  const reasons: string[] = [];
  const unsigned = {
    id: receipt.id,
    agentId: receipt.agentId,
    mandateId: receipt.mandateId,
    actionType: receipt.actionType,
    tool: receipt.tool,
    target: receipt.target,
    costUsd: receipt.costUsd,
    decision: receipt.decision,
    reason: receipt.reason,
    matchedRule: receipt.matchedRule,
    riskLevel: receipt.riskLevel,
    timestamp: receipt.timestamp,
    policyHash: receipt.policyHash,
    rawPayload: receipt.rawPayload ?? {},
  };
  const canonicalUnsigned = canonicalize(unsigned);
  const expectedReceiptHash = createHash("sha256").update(canonicalUnsigned).digest("hex");
  if (expectedReceiptHash !== receipt.receiptHash) {
    reasons.push("receiptHash does not match canonical payload");
  }
  const signedPayload = canonicalize({ ...unsigned, receiptHash: expectedReceiptHash });
  const sigBuf = Buffer.from(receipt.signature, "base64");
  const key = createPublicKey(publicKeyPem);
  const ok = verify(null, Buffer.from(signedPayload, "utf8"), key, sigBuf);
  if (!ok) reasons.push("signature does not match Ed25519 public key");
  return { valid: reasons.length === 0, reasons };
}

function canonicalize(value: unknown): string {
  return JSON.stringify(canonical(value));
}
function canonical(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = canonical(v);
  }
  return out;
}
