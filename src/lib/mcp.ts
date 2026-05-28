// MandateSeal — Model Context Protocol (MCP) server adapter (v0.8).
//
// Exposes every registered Tool in the MandateSeal Tool registry as an MCP
// tool, gated by the same policy engine that fronts /api/proxy/:tool. The
// client (Claude Desktop, Claude Code, Cursor, custom MCP host) calls
// `tools/list` to discover what's available and `tools/call` to invoke; on
// each call MandateSeal:
//
//   1. evaluateAndSeal()  → preflight receipt covering the policy decision
//   2. fetch upstream     → if APPROVED, forward to tool.endpoint
//   3. sealOutcomeReceipt → second sealed receipt covering the response
//
// The MCP host gets the upstream JSON back as content, plus structured
// metadata (decision, preflight receipt id, outcome receipt id, body sha256)
// in the response so the host can surface "this was sealed by MandateSeal".
//
// Transport: a single POST /api/mcp endpoint that accepts JSON-RPC 2.0.
// Notifications and SSE streaming are not implemented in this first cut
// (Vercel serverless idle limits make long-lived SSE expensive).
//
// This module is pure dispatch + types — no Prisma, no fetch. The route
// wires it to the DB + upstream.

export const MCP_PROTOCOL_VERSION = "2024-11-05";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific application errors
  POLICY_BLOCKED: -32001,
  TOOL_NOT_FOUND: -32002,
  UPSTREAM_ERROR: -32003,
  UNAUTHORIZED: -32004,
} as const;

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolForMcp {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  defaultCostUsd: number;
  enabled: boolean;
}

/** Convert a stored Tool row into the shape MCP `tools/list` expects. */
export function toMcpTool(t: ToolForMcp): McpTool {
  // No per-tool inputSchema is stored yet — fall back to a permissive
  // "any JSON object" schema. Operators can tighten this later by adding
  // a schema column to the Tool model.
  return {
    name: t.name,
    description: t.description || `Proxied through MandateSeal → ${t.endpoint}`,
    inputSchema: {
      type: "object",
      properties: {
        body: {
          type: "object",
          description: "JSON body forwarded as-is to the upstream tool.",
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
  };
}

/** Build the server-info response for the `initialize` handshake. */
export function buildInitializeResult(): unknown {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: {
      name: "mandateseal",
      version: "0.8.0",
      title: "MandateSeal",
    },
    capabilities: {
      tools: {
        // We don't yet emit listChanged notifications — clients should poll
        // tools/list when they want a fresh registry view.
        listChanged: false,
      },
    },
    instructions:
      "Every tool call is gated by the agent's MandateSeal mandate. Calls produce a preflight receipt (policy decision) and an outcome receipt (upstream response). Both are Ed25519-signed and merkle-anchored.",
  };
}

/** Standard JSON-RPC error response builder. */
export function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

export function rpcResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

/** Parse + validate a request body. Returns either a request or a JSON-RPC error. */
export function parseRpcRequest(body: unknown): { ok: true; req: JsonRpcRequest } | { ok: false; res: JsonRpcResponse } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, res: rpcError(null, RPC_ERRORS.INVALID_REQUEST, "Request body must be a JSON object") };
  }
  const b = body as Record<string, unknown>;
  if (b.jsonrpc !== "2.0") {
    return { ok: false, res: rpcError((b.id as string | number | null) ?? null, RPC_ERRORS.INVALID_REQUEST, "jsonrpc must be '2.0'") };
  }
  if (typeof b.method !== "string" || b.method.length === 0) {
    return { ok: false, res: rpcError((b.id as string | number | null) ?? null, RPC_ERRORS.INVALID_REQUEST, "method must be a non-empty string") };
  }
  const id = (b.id as string | number | null | undefined) ?? null;
  return { ok: true, req: { jsonrpc: "2.0", id, method: b.method, params: (b.params as Record<string, unknown>) ?? {} } };
}
