import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateAgent } from "@/lib/auth";
import { evaluateAndSeal, sealOutcomeReceipt } from "@/lib/receipt";
import { sha256Bytes } from "@/lib/crypto";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
// LIFECYCLE — preflight + outcome (v0.8).
//   1. Preflight receipt seals the policy decision BEFORE the upstream call.
//   2. After the upstream returns (or errors), an outcome receipt is sealed
//      covering upstream status, latency, byte counts, and a sha256 of the
//      response body. The outcome receipt is linked back to the preflight
//      via preflightReceiptId and is independently verifiable.
//   3. Both receipts are emitted into the webhook fanout and the audit log.
//
// "Approve before. Prove after." — preflight = approve, outcome = prove.
export async function POST(req: Request, { params }: { params: { tool: string } }) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    const ipLimit = checkRateLimit(`proxy:ip:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
    if (!ipLimit.allowed) {
      const r = rateLimitResponse(ipLimit);
      return NextResponse.json(r.body, r.init);
    }
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  const agentLimit = checkRateLimit(`proxy:agent:${agent.id}`, { limit: 60, windowMs: 60_000 });
  if (!agentLimit.allowed) {
    const r = rateLimitResponse(agentLimit);
    return NextResponse.json(r.body, r.init);
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
    const bodyHash = sha256Bytes(buf);

    // v0.8 — seal the outcome receipt. Failures here are logged but do not
    // tank the response — the caller still gets the upstream bytes, and the
    // preflight receipt is already persisted as the audit anchor.
    let outcomeId: string | null = null;
    let outcomeHash: string | null = null;
    try {
      const outcome = await sealOutcomeReceipt({
        preflight: receipt,
        upstreamStatus: upstreamRes.status,
        upstreamDurationMs: durationMs,
        upstreamBytesIn: buf.byteLength,
        upstreamBytesOut: rawBody.byteLength,
        upstreamBodyHash: bodyHash,
      });
      outcomeId = outcome.id;
      outcomeHash = outcome.receiptHash;
    } catch (sealErr) {
      console.error("[proxy] outcome seal failed", sealErr);
    }

    const headers: Record<string, string> = {
      "content-type": upstreamRes.headers.get("content-type") ?? "application/octet-stream",
      "x-mandateseal-receipt": receipt.id,
      "x-mandateseal-decision": receipt.decision,
      "x-mandateseal-upstream-status": String(upstreamRes.status),
      "x-mandateseal-duration-ms": String(durationMs),
      "x-mandateseal-body-sha256": bodyHash,
    };
    if (outcomeId) headers["x-mandateseal-outcome-receipt"] = outcomeId;
    if (outcomeHash) headers["x-mandateseal-outcome-hash"] = outcomeHash;

    return new NextResponse(buf, { status: upstreamRes.status, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    const aborted = msg.includes("aborted") || (err as Error)?.name === "AbortError";
    const durationMs = Date.now() - startedAt;

    // v0.8 — seal an outcome receipt even on error so the audit log shows
    // the upstream failure (504 timeout / 502 etc.) and not just an empty
    // preflight. Body hash is sha256 of empty bytes.
    let outcomeId: string | null = null;
    try {
      const outcome = await sealOutcomeReceipt({
        preflight: receipt,
        upstreamStatus: aborted ? 504 : 502,
        upstreamDurationMs: durationMs,
        upstreamBytesIn: 0,
        upstreamBytesOut: rawBody.byteLength,
        upstreamBodyHash: sha256Bytes(new Uint8Array(0)),
      });
      outcomeId = outcome.id;
    } catch (sealErr) {
      console.error("[proxy] outcome seal failed (on error path)", sealErr);
    }

    return NextResponse.json(
      {
        error: aborted ? `Upstream timed out after ${PROXY_TIMEOUT_MS}ms` : msg,
        receipt: { id: receipt.id, decision: receipt.decision },
        ...(outcomeId ? { outcomeReceiptId: outcomeId } : {}),
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
