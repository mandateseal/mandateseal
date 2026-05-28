import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

// Dynamic OG image for /r/[id] — generated server-side so every shared
// receipt link surfaces a real preview on Twitter, Telegram, Discord,
// Farcaster, etc. instead of the default site icon.
//
// Satori (next/og) is strict: every div with multiple children needs
// display:flex explicitly. The styles below all set it.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DECISION_TONE: Record<string, { bg: string; text: string }> = {
  APPROVED: { bg: "#1e3a2a", text: "#7dd3a8" },
  BLOCKED: { bg: "#3a1e1e", text: "#f08585" },
  NEEDS_APPROVAL: { bg: "#3a2f1e", text: "#e6c178" },
};

function fallback(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0b0b0a",
          color: "#d4d4d2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          letterSpacing: 6,
        }}
      >
        {message}
      </div>
    ),
    size,
  );
}

export default async function OpengraphImage({ params }: { params: { id: string } }) {
  try {
    const r = await prisma.receipt.findUnique({
      where: { id: params.id },
      include: { agent: { select: { name: true } } },
    });
    if (!r) return fallback("RECEIPT NOT FOUND");

    const tone = DECISION_TONE[r.decision] ?? DECISION_TONE.APPROVED;
    const dt = new Date(r.timestamp).toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const meta = [r.tool, r.chain, r.token].filter(Boolean).join(" / ");
    const txValue =
      r.txValueUsd !== null && r.txValueUsd !== undefined
        ? `$${Number(r.txValueUsd).toFixed(2)}`
        : "";

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#0b0b0a",
            color: "#d4d4d2",
            display: "flex",
            flexDirection: "column",
            padding: "60px 70px",
          }}
        >
          {/* Header strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 18,
              letterSpacing: 6,
              color: "#8e8e88",
            }}
          >
            <div style={{ display: "flex" }}>&gt; MANDATESEAL · PUBLIC RECEIPT</div>
            <div style={{ display: "flex", color: "#d9b46a" }}>ED25519 · ANCHORED</div>
          </div>

          {/* Decision row */}
          <div style={{ display: "flex", marginTop: 50, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                background: tone.bg,
                color: tone.text,
                padding: "14px 28px",
                fontSize: 30,
                letterSpacing: 5,
                border: `1px solid ${tone.text}`,
              }}
            >
              {r.decision}
            </div>
            <div
              style={{
                display: "flex",
                marginLeft: 20,
                padding: "14px 26px",
                fontSize: 22,
                letterSpacing: 3,
                color: "#8e8e88",
                border: "1px solid #2a2a28",
              }}
            >
              RISK · {r.riskLevel}
            </div>
          </div>

          {/* Action */}
          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 56,
              color: "#f4f1e8",
            }}
          >
            {r.actionType}
          </div>

          {/* Meta line */}
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 24,
              color: "#a8a7a0",
              gap: 24,
            }}
          >
            <div style={{ display: "flex" }}>{meta}</div>
            {txValue && <div style={{ display: "flex" }}>{txValue}</div>}
          </div>

          {/* Reason */}
          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 22,
              color: "#d4d4d2",
              maxWidth: 1060,
            }}
          >
            {r.reason}
          </div>

          {/* Spacer */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: 16,
              color: "#6c6c66",
              letterSpacing: 3,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", color: "#a8a7a0", marginBottom: 6 }}>
                AGENT · {r.agent.name}
              </div>
              <div style={{ display: "flex" }}>{dt}</div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <div style={{ display: "flex", color: "#a8a7a0", marginBottom: 6 }}>
                HASH · {r.receiptHash.slice(0, 20)}…
              </div>
              <div style={{ display: "flex" }}>{r.id}</div>
            </div>
          </div>
        </div>
      ),
      size,
    );
  } catch (err) {
    console.error("[opengraph-image] failed", err);
    return fallback("MANDATESEAL");
  }
}
