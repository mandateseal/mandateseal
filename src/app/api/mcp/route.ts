import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateAgent } from "@/lib/auth";
import { evaluateAndSeal, sealOutcomeReceipt } from "@/lib/receipt";
import { sha256Bytes } from "@/lib/crypto";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";
import {
  buildInitializeResult,
  parseRpcRequest,
  RPC_ERRORS,
  rpcError,
  rpcResult,
  toMcpTool,
  type JsonRpcResponse,
} from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 25_000;

// POST /api/mcp
// Streamable-HTTP MCP transport (single endpoint, JSON-RPC 2.0 over POST).
// Bearer-authed with the agent's MandateSeal API key so the entire MCP
// session is identified as that agent — every tool call seals receipts
// against that agent's mandate.
//
// Methods implemented:
//   initialize                — handshake, returns server info + capabilities
//   notifications/initialized — no-op ack
//   tools/list                — returns enabled Tool registry as MCP tools
//   tools/call                — preflight + upstream + outcome (3 receipts? no — 2)
//   ping                      — returns {}
//
// Streaming, resources, prompts, sampling: not implemented in v0.8 first cut.
export async function POST(req: Request) {
  // Bearer auth covers both per-IP brute force (when no/bad key) and
  // per-agent abuse (when valid key but high volume).
  const agent = await authenticateAgent(req);
  if (!agent) {
    const ipLimit = checkRateLimit(`mcp:ip:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
    if (!ipLimit.allowed) {
      const r = rateLimitResponse(ipLimit);
      return NextResponse.json(r.body, r.init);
    }
    return NextResponse.json(
      rpcError(null, RPC_ERRORS.UNAUTHORIZED, "Missing or invalid bearer token"),
      { status: 401 },
    );
  }
  const agentLimit = checkRateLimit(`mcp:agent:${agent.id}`, { limit: 120, windowMs: 60_000 });
  if (!agentLimit.allowed) {
    const r = rateLimitResponse(agentLimit);
    return NextResponse.json(r.body, r.init);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, RPC_ERRORS.PARSE_ERROR, "Invalid JSON"));
  }

  const parsed = parseRpcRequest(body);
  if (!parsed.ok) return NextResponse.json(parsed.res);
  const { req: rpc } = parsed;

  const reply = await dispatch(rpc.method, rpc.params ?? {}, rpc.id ?? null, agent.id);
  return NextResponse.json(reply);
}

async function dispatch(
  method: string,
  params: Record<string, unknown>,
  id: string | number | null,
  agentId: string,
): Promise<JsonRpcResponse> {
  switch (method) {
    case "initialize":
      return rpcResult(id, buildInitializeResult());

    case "notifications/initialized":
      // Notifications carry id=null per JSON-RPC; some clients still send
      // an id, so reply with an empty result either way.
      return rpcResult(id, {});

    case "ping":
      return rpcResult(id, {});

    case "tools/list": {
      const tools = await prisma.tool.findMany({
        where: { enabled: true },
        orderBy: { name: "asc" },
      });
      return rpcResult(id, { tools: tools.map(toMcpTool) });
    }

    case "tools/call": {
      const toolName = params.name as string | undefined;
      const args = (params.arguments as Record<string, unknown> | undefined) ?? {};
      if (!toolName) {
        return rpcError(id, RPC_ERRORS.INVALID_PARAMS, "tools/call requires `name`");
      }
      return callTool(id, agentId, toolName, args);
    }

    default:
      return rpcError(id, RPC_ERRORS.METHOD_NOT_FOUND, `Unknown method: ${method}`, { method });
  }
}

async function callTool(
  id: string | number | null,
  agentId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const tool = await prisma.tool.findFirst({
    where: { OR: [{ id: toolName }, { name: toolName }], enabled: true },
  });
  if (!tool) {
    return rpcError(id, RPC_ERRORS.TOOL_NOT_FOUND, `Tool not found: ${toolName}`);
  }

  // The MCP arguments shape is `{ body: { ... } }` per our inputSchema in
  // toMcpTool(). Fall back to using `args` as-is if the client passes a
  // flat object instead of nesting under `body`.
  const rawBody = (args.body && typeof args.body === "object" ? args.body : args) as Record<string, unknown>;
  const bodyBytes = new TextEncoder().encode(JSON.stringify(rawBody));

  // 1. Preflight: policy decision sealed.
  let preflight;
  try {
    preflight = await evaluateAndSeal({
      agentId,
      actionType: "tool_call",
      tool: tool.name,
      target: tool.endpoint,
      costUsd: tool.defaultCostUsd,
      metadata: {
        proxy: "mcp",
        toolId: tool.id,
        method: tool.method,
        bodyBytes: bodyBytes.byteLength,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "evaluator failed";
    return rpcError(id, RPC_ERRORS.INTERNAL_ERROR, msg);
  }

  if (preflight.decision !== "APPROVED") {
    return rpcError(id, RPC_ERRORS.POLICY_BLOCKED, preflight.reason, {
      decision: preflight.decision,
      matchedRule: preflight.matchedRule,
      receiptId: preflight.id,
      receiptHash: preflight.receiptHash,
    });
  }

  // 2. Forward to upstream.
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let upstreamStatus: number;
  let upstreamBuf: ArrayBuffer;
  let upstreamContentType: string;
  try {
    const upstreamRes = await fetch(tool.endpoint, {
      method: tool.method,
      headers: {
        "content-type": "application/json",
        "user-agent": `MandateSeal-MCP/0.8 (agent=${agentId} tool=${tool.name})`,
        "x-mandateseal-receipt": preflight.id,
      },
      signal: controller.signal,
      ...(["POST", "PUT", "PATCH", "DELETE"].includes(tool.method) && bodyBytes.byteLength > 0
        ? { body: bodyBytes }
        : {}),
    });
    upstreamStatus = upstreamRes.status;
    upstreamBuf = await upstreamRes.arrayBuffer();
    upstreamContentType = upstreamRes.headers.get("content-type") ?? "application/octet-stream";
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : "fetch failed";
    const aborted = msg.includes("aborted") || (err as Error)?.name === "AbortError";
    // Still seal an outcome receipt so the audit log captures the failure.
    try {
      await sealOutcomeReceipt({
        preflight,
        upstreamStatus: aborted ? 504 : 502,
        upstreamDurationMs: Date.now() - startedAt,
        upstreamBytesIn: 0,
        upstreamBytesOut: bodyBytes.byteLength,
        upstreamBodyHash: sha256Bytes(new Uint8Array(0)),
      });
    } catch {
      /* swallow — preflight already captured what we know */
    }
    return rpcError(id, RPC_ERRORS.UPSTREAM_ERROR, aborted ? "Upstream timeout" : msg, {
      receiptId: preflight.id,
    });
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Date.now() - startedAt;
  const bodyHash = sha256Bytes(upstreamBuf);

  // 3. Seal outcome receipt.
  let outcome;
  try {
    outcome = await sealOutcomeReceipt({
      preflight,
      upstreamStatus,
      upstreamDurationMs: durationMs,
      upstreamBytesIn: upstreamBuf.byteLength,
      upstreamBytesOut: bodyBytes.byteLength,
      upstreamBodyHash: bodyHash,
    });
  } catch {
    outcome = null;
  }

  // 4. Compose MCP tool result. We prefer to surface upstream JSON as
  // structured content; if the upstream returned anything else, fall back
  // to a text block.
  const text = new TextDecoder().decode(upstreamBuf);
  const isJson = upstreamContentType.includes("application/json");
  const content: Array<{ type: string; text: string }> = isJson
    ? [{ type: "text", text }]
    : [{ type: "text", text: `[${upstreamContentType}] ${upstreamBuf.byteLength}B body, sha256 ${bodyHash}` }];

  return rpcResult(id, {
    content,
    isError: upstreamStatus >= 400,
    structuredContent: isJson ? safeParseJson(text) : undefined,
    _meta: {
      mandateseal: {
        preflightReceiptId: preflight.id,
        preflightReceiptHash: preflight.receiptHash,
        outcomeReceiptId: outcome?.id ?? null,
        outcomeReceiptHash: outcome?.receiptHash ?? null,
        upstreamStatus,
        upstreamDurationMs: durationMs,
        upstreamBodySha256: bodyHash,
      },
    },
  });
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

// GET /api/mcp — health probe for MCP hosts that want to confirm the
// transport is alive without doing a full initialize.
export async function GET() {
  return NextResponse.json({
    transport: "streamable-http",
    server: "mandateseal",
    version: "0.8.0",
    endpoint: "POST /api/mcp",
  });
}
