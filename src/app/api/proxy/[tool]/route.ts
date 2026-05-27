import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateAgent } from "@/lib/auth";
import { evaluateAndSeal } from "@/lib/receipt";

export const runtime = "nodejs";

const PROXY_TIMEOUT_MS = 25_000;
const FORWARD_DROP_HEADERS = new Set([
  "host",
  "cookie",
  "authorization", // never leak agent's bearer to upstream
  "content-length",
  "connection",
]);

// POST /api/proxy/:tool
//
// Bearer-authed proxy. MandateSeal:
//   1. Resolves tool by name or id.
//   2. Runs the policy engine via evaluateAndSeal — this is the preflight
//      receipt the auditor will see. Decision drives whether we forward.
//   3. If APPROVED, forwards body to tool.endpoint with tool.method,
//      streaming the response back. Outcome (status, durationMs, bytes) is
//      embedded in the response headers but the *upstream body* is the body.
//   4. If NOT APPROVED, returns the decision and approval handle.
//
// The pre-receipt is the only receipt we mint per proxy call in v0.7; the
// outcome wrap into a sealed post-receipt is deferred to v0.7.1 (would need
// a second canonical hash + signing pass on completion).
export async function POST(req: Request, { params }: { params: { tool: string } }) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const tool = await prisma.tool.findFirst({
    where: { OR: [{ id: params.tool }, { name: params.tool }] },
  });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  if (!tool.enabled) return NextResponse.json({ error: "Tool is disabled" }, { status: 403 });

  // Read body once — we'll need bytes both for upstream forwarding and for
  // the policy receipt's target/metadata.
  const rawBody = await req.arrayBuffer();
  const upstreamContentType = req.headers.get("content-type") ?? "application/json";

  // Seal a preflight receipt that captures this proxy attempt.
  let receipt;
  try {
    receipt = await evaluateAndSeal({
      agentId: agent.id,
      actionType: "tool_call",
      tool: tool.name,
      target: tool.endpoint,
      costUsd: tool.defaultCostUsd,
      metadata: {
        proxy: true,
        toolId: tool.id,
        method: tool.method,
        contentType: upstreamContentType,
        bodyBytes: rawBody.byteLength,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (receipt.decision !== "APPROVED") {
    return NextResponse.json(
      {
        decision: receipt.decision,
        reason: receipt.reason,
        matchedRule: receipt.matchedRule,
        receipt,
      },
      { status: 403 },
    );
  }

  // Build forwarded headers — strip auth / host / cookie / content-length.
  const fwdHeaders = new Headers();
  req.headers.forEach((v, k) => {
    if (!FORWARD_DROP_HEADERS.has(k.toLowerCase())) fwdHeaders.set(k, v);
  });
  fwdHeaders.set("user-agent", `MandateSeal-Proxy/0.7 (agent=${agent.id} tool=${tool.name})`);
  fwdHeaders.set("x-mandateseal-receipt", receipt.id);

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const upstreamReq: RequestInit = {
      method: tool.method,
      headers: fwdHeaders,
      signal: controller.signal,
      // Only attach body for methods that allow one.
      ...(["POST", "PUT", "PATCH", "DELETE"].includes(tool.method) && rawBody.byteLength > 0
        ? { body: rawBody }
        : {}),
    };
    const upstreamRes = await fetch(tool.endpoint, upstreamReq);
    const buf = await upstreamRes.arrayBuffer();
    const durationMs = Date.now() - startedAt;

    const out = new NextResponse(buf, {
      status: upstreamRes.status,
      headers: {
        "content-type": upstreamRes.headers.get("content-type") ?? "application/octet-stream",
        "x-mandateseal-receipt": receipt.id,
        "x-mandateseal-decision": receipt.decision,
        "x-mandateseal-upstream-status": String(upstreamRes.status),
        "x-mandateseal-duration-ms": String(durationMs),
      },
    });
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    const aborted = msg.includes("aborted") || (err as Error)?.name === "AbortError";
    return NextResponse.json(
      {
        error: aborted ? `Upstream timed out after ${PROXY_TIMEOUT_MS}ms` : msg,
        receipt: { id: receipt.id, decision: receipt.decision },
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
