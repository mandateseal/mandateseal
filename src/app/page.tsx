import Link from "next/link";
import { StampBadge } from "@/components/StampBadge";

const pillars = [
  {
    no: "01",
    title: "A MANDATE BEFORE EVERY ACTION.",
    body: "Define what the agent may spend, which tools it may call, which domains it may touch. Enforce it at the wire, not in a prompt.",
  },
  {
    no: "02",
    title: "A RECEIPT AFTER EVERY ACTION.",
    body: "Every decision produces a canonical, HMAC-signed receipt. Hashed, immutable, replayable.",
  },
  {
    no: "03",
    title: "TRUST IS A LOG, NOT A PROMISE.",
    body: "Verify any receipt against the signing key. The log is the contract; the contract is the proof.",
  },
];

export default function Landing() {
  return (
    <div>
      <section className="page-container pt-16 pb-12">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
          <div>
            <div className="label">DISPATCH · BULLETIN 001</div>
            <h1 className="display-title mt-4 text-[clamp(2.4rem,6vw,5rem)] text-paper">
              AUTONOMY NEEDS
              <br />
              ACCOUNTABILITY.
            </h1>
            <p className="mt-6 max-w-2xl text-paperMuted text-base leading-relaxed">
              MandateSeal is the trust layer for autonomous AI agents. Approve before. Prove after.
              Every action checked against a mandate. Every decision sealed as a verifiable receipt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard" className="command-button accent">Open Dashboard</Link>
              <Link href="/docs" className="command-button">Read Docs</Link>
              <Link href="/verify" className="command-button">Verify a Receipt</Link>
            </div>
          </div>
          <div className="paper-panel p-6">
            <div className="flex items-center justify-between">
              <span className="label">SAMPLE RECEIPT</span>
              <StampBadge status="APPROVED" />
            </div>
            <div className="dashed-rule my-4" />
            <div className="space-y-2 font-tech text-[12px] text-paper">
              <div className="flex justify-between gap-4"><span className="text-paperMuted">agent</span><span>Atlas-01</span></div>
              <div className="flex justify-between gap-4"><span className="text-paperMuted">action</span><span>paid_api_call</span></div>
              <div className="flex justify-between gap-4"><span className="text-paperMuted">target</span><span className="truncate">api.openai.com</span></div>
              <div className="flex justify-between gap-4"><span className="text-paperMuted">cost</span><span>$0.02</span></div>
              <div className="flex justify-between gap-4"><span className="text-paperMuted">risk</span><span>LOW</span></div>
            </div>
            <div className="dashed-rule my-4" />
            <div className="space-y-2 text-[11px] font-tech break-all text-paperMuted">
              <div>receiptHash 7a1f…c4b0</div>
              <div>signature  9e3c…ff19</div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-container py-8 grid md:grid-cols-3 gap-4">
        {pillars.map((p) => (
          <div key={p.no} className="ink-panel p-5">
            <div className="font-tech text-[10px] text-paperMuted tracking-[0.22em]">// {p.no}</div>
            <h3 className="font-display text-paper text-lg mt-2 tracking-[0.04em]">{p.title}</h3>
            <p className="mt-3 text-sm text-paperMuted leading-relaxed">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="page-container py-12">
        <div className="label">THE FLOW</div>
        <h2 className="display-title text-paper text-3xl md:text-4xl mt-3">APPROVE BEFORE. PROVE AFTER.</h2>
        <div className="mt-6 ink-panel p-5 font-tech text-[12px] leading-relaxed text-paper whitespace-pre overflow-x-auto">
{`agent wants to act
  → POST /api/check       (Bearer <agent_api_key>)
  ← MandateSeal returns   APPROVED | BLOCKED | NEEDS_APPROVAL
  → if APPROVED, agent runs the action
  ← MandateSeal emits a signed receipt
  → anyone can call /api/verify to confirm it later`}
        </div>
      </section>
    </div>
  );
}
