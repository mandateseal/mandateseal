import Link from "next/link";

const pillars = [
  {
    no: "01",
    title: "Policy checks before actions",
    body: "Set tool, domain, action, and cost limits for each agent. Requests are checked before the agent is allowed to continue.",
  },
  {
    no: "02",
    title: "Receipts for every decision",
    body: "Each check creates a signed receipt with the agent, mandate, action, reason, policy hash, and receipt hash.",
  },
  {
    no: "03",
    title: "A log your team can inspect",
    body: "Search approvals, blocked attempts, spend, and receipt history when you need to answer what an agent tried to do.",
  },
];

const stats = [
  ["10", "policy rules"],
  ["3", "decision states"],
  ["Ed25519", "signed receipts"],
];

const gatewaySteps = [
  ["01", "Request", "agent_atlas_01 wants to call web_search"],
  ["02", "Decision", "tool allowed, cost below max action limit"],
  ["03", "Receipt", "rct_4d59... sealed and stored"],
];

export default function Landing() {
  return (
    <div>
      <section className="page-container hero-section">
        <div className="hero-shell">
          <div className="hero-copy">
            <div className="eyebrow">Agent action gateway</div>
            <h1 className="hero-title">
              <span>Autonomy</span>
              <span>Needs</span>
              <span>Accountability.</span>
            </h1>
            <p className="hero-subcopy">
              MandateSeal checks agent actions against explicit rules before execution and records
              the result as a signed receipt your team can verify later.
            </p>
            <div className="hero-actions">
              <Link href="/dashboard" className="command-button accent">Open Console</Link>
              <Link href="/verify" className="command-button">Verify Receipt</Link>
              <Link href="/docs" className="command-button">Read Docs</Link>
            </div>
            <div className="hero-stats">
              {stats.map(([value, label]) => (
                <div key={label}>
                  <div className="hero-stat-value">{value}</div>
                  <div className="hero-stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-receipt paper-panel">
            <div className="receipt-header">
              <div>
                <span className="label">POLICY CHECK</span>
                <span className="receipt-id-tag">live preflight</span>
              </div>
              <span className="decision-pill approved">APPROVED</span>
            </div>
            <div className="mt-4 terminal-strip">
              <span><span className="method-pill">POST</span> /api/check</span>
              <span>42ms</span>
            </div>
            <div className="dashed-rule my-4" />
            <div className="space-y-3 font-tech text-[12px] text-paper">
              <ReceiptLine k="agent" v="Atlas-01" />
              <ReceiptLine k="action" v="paid_api_call" />
              <ReceiptLine k="tool" v="web_search" />
              <ReceiptLine k="target" v="api.openai.com" />
              <ReceiptLine k="cost" v="$0.02" />
              <ReceiptLine k="matched rule" v="allowed_tools" />
              <ReceiptLine k="reason" v="tool allowed, cost under limit" />
            </div>
            <div className="dashed-rule my-4" />
            <div className="space-y-2 text-[11px] font-tech break-all text-paperMuted">
              <div>receipt rct_4d593e95eabbe1e06b8c</div>
              <div>policyHash 8b7d4f91a22c90e5c31a0f6e42bd98a2</div>
              <div>receiptHash 42f9c71bd0a35e7c1e8ad9910e67f3ab</div>
            </div>
            <div className="mt-5 receipt-status-row">
              <span>mandate mnd_prod_01</span>
              <span>stored</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-container pb-8">
        <div className="gateway-strip">
          {gatewaySteps.map(([no, title, body]) => (
            <div key={no} className="gateway-step">
              <div className="gateway-no">{no}</div>
              <div>
                <div className="gateway-title">{title}</div>
                <div className="gateway-body">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="page-container py-8 grid md:grid-cols-3 gap-4">
        {pillars.map((p) => (
          <div key={p.no} className="feature-panel ink-panel p-5">
            <div className="font-tech text-[10px] text-paperMuted tracking-[0.22em]">// {p.no}</div>
            <h3 className="font-display text-paper text-lg mt-2 tracking-[0.04em]">{p.title}</h3>
            <p className="mt-3 text-sm text-paperMuted leading-relaxed">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="page-container py-12">
        <div className="label">THE FLOW</div>
        <h2 className="display-title text-paper text-3xl md:text-4xl mt-3">APPROVE BEFORE. PROVE AFTER.</h2>
        <div className="mt-6 flow-panel ink-panel p-5 font-tech text-[12px] leading-relaxed text-paper whitespace-pre overflow-x-auto">
{`agent wants to act
  -> POST /api/check       (Bearer <agent_api_key>)
  <- MandateSeal returns   APPROVED | BLOCKED | NEEDS_APPROVAL
  -> if APPROVED, agent runs the action
  <- MandateSeal emits a signed receipt
  -> anyone can call /api/verify to confirm it later`}
        </div>
      </section>

    </div>
  );
}

function ReceiptLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-paperMuted shrink-0">{k}</span>
      <span className="text-right break-all min-w-0">{v}</span>
    </div>
  );
}
