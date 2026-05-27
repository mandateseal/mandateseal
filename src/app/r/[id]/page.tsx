import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { publicReceipt, redactedReceipt } from "@/lib/serialize";
import { recomputeAndVerify, reEvaluateFromSnapshot } from "@/lib/receipt";
import { ReceiptCard } from "@/components/ReceiptCard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

async function loadReceipt(id: string) {
  const stored = await prisma.receipt.findUnique({
    where: { id },
    include: { agent: { select: { id: true, name: true } } },
  });
  if (!stored) return null;
  const full = publicReceipt(stored);
  return {
    // Full version is kept server-side for verification recomputation.
    full,
    // Redacted version is what reaches the client / Copy JSON button.
    view: redactedReceipt(full),
    agent: stored.agent,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await loadReceipt(params.id);
  if (!data) return { title: "Receipt not found · MandateSeal" };
  const r = data.view;
  const title = `${r.decision} · ${r.actionType} · MandateSeal Receipt`;
  const description = `Agent ${data.agent.name}. Decision ${r.decision}. ${r.matchedRule}. Sealed at ${r.timestamp}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: ["/mandateseal-mark.svg"],
    },
    twitter: { card: "summary", title, description, images: ["/mandateseal-mark.svg"] },
  };
}

export default async function PublicReceiptPage({ params }: PageProps) {
  const data = await loadReceipt(params.id);
  if (!data) notFound();

  // Verify uses the FULL stored payload (server-side only). The redacted
  // version is what we pass to client components.
  const verdict = recomputeAndVerify({ ...data.full, rawPayload: data.full.rawPayload ?? {} });
  const reEval = reEvaluateFromSnapshot({ ...data.full, rawPayload: data.full.rawPayload ?? {} });
  const r = data.view;

  return (
    <div className="page-container py-10 max-w-3xl">
      <div className="label">PUBLIC RECEIPT</div>
      <h1 className="display-title text-paper text-2xl md:text-3xl mt-2">
        SEAL · {r.id}
      </h1>
      <p className="mt-2 text-paperMuted text-sm">
        Issued by MandateSeal for{" "}
        <Link href={`/a/${data.agent.id}`} className="text-paper hover:underline">
          {data.agent.name}
        </Link>
        . Anyone can verify this receipt against the published Ed25519 public key.
      </p>

      <div className="mt-4 paper-panel p-4">
        <div className="grid sm:grid-cols-3 gap-3 font-tech text-[12px]">
          <Cell k="server-recompute" v={verdict.valid ? "valid ✓" : "INVALID ✗"} tone={verdict.valid ? "text-green" : "text-red"} />
          <Cell k="policy re-evaluation" v={reEval.matched ? "matched ✓" : "mismatch ✗"} tone={reEval.matched ? "text-green" : "text-amber"} />
          <Cell k="public verifier key" v="GET /api/key.pub" mono />
        </div>
        {!verdict.valid && verdict.reasons.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-red text-sm">
            {verdict.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <ReceiptCard receipt={r} />
      </div>

      <div className="mt-6 ink-panel p-5">
        <div className="label">PUBLIC VERIFICATION</div>
        <p className="mt-2 text-paperMuted text-sm">
          This public page redacts the internal raw payload. Use the Verify button or submit the
          receipt id to the server verifier. Fully offline verification requires the complete
          unredacted receipt JSON from the admin API or SDK.
        </p>
        <pre className="mt-3 font-tech text-[11px] text-paper overflow-x-auto whitespace-pre">
{`curl -X POST /api/verify \\
  -H "content-type: application/json" \\
  -d '{"id":"${r.id}"}'`}
        </pre>
      </div>

      <div className="mt-6 flex gap-3">
        <Link href={`/a/${data.agent.id}`} className="command-button">View Agent</Link>
        <Link href="/verify" className="command-button">Open Verifier</Link>
      </div>
    </div>
  );
}

function Cell({ k, v, mono, tone = "text-paper" }: { k: string; v: string; mono?: boolean; tone?: string }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className={`${mono ? "font-tech text-[12px]" : "font-tech text-[12px]"} ${tone}`}>{v}</div>
    </div>
  );
}
