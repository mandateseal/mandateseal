// MandateSeal TypeScript SDK.
//
//   import { MandateSeal } from "./sdk/mandateseal";
//   const seal = new MandateSeal({ apiKey: process.env.MANDATESEAL_API_KEY!, baseUrl: "http://localhost:3000" });
//   const result = await seal.check({ agentId, actionType, tool, target, costUsd });
//   if (result.decision !== "APPROVED") throw new Error(result.reason);

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

export class MandateSealError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "MandateSealError";
    this.status = status;
    this.body = body;
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

  /** Verify a stored or third-party receipt. */
  async verifyReceipt(receipt: Receipt | { id: string }): Promise<{ valid: boolean; reasons: string[] }> {
    return this.request<{ valid: boolean; reasons: string[] }>("/api/verify", receipt, false);
  }

  /** List receipts (optionally filtered by agent). */
  async listReceipts(opts?: { agentId?: string; limit?: number }): Promise<{ receipts: Receipt[] }> {
    const qs = new URLSearchParams();
    if (opts?.agentId) qs.set("agentId", opts.agentId);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const path = "/api/receipts" + (qs.toString() ? "?" + qs.toString() : "");
    return this.getJson<{ receipts: Receipt[] }>(path);
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
        (data && typeof data === "object" && "error" in (data as Record<string, unknown>)
          ? String((data as Record<string, unknown>).error)
          : `MandateSeal ${path} failed`);
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
