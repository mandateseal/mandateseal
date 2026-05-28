import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { publicReceipt, redactedReceipt, parsePublicFields } from "@/lib/serialize";
import { recomputeAndVerify, reEvaluateFromSnapshot } from "@/lib/receipt";
import { ReceiptCard } from "@/components/ReceiptCard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: { embed?: string };
}

async function loadReceipt(id: string) {
  const stored = await prisma.receipt.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true } },
      mandate: { select: { publicFields: true } },
    },
  });
  if (!stored) return null;
  const full = publicReceipt(stored);
  const policy = parsePublicFields(stored.mandate?.publicFields ?? null);
  return {
    // Full version is kept server-side for verification recomputation.
    full,
    // Redacted version respects the mandate's publicFields policy. Null
    // policy → built-in defaults (rawPayload-only redaction, pre-v0.4).
    view: redactedReceipt(full, policy),
    agent: stored.agent,
    publicFieldsPolicy: policy,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await loadReceipt(params.id);
  if (!data) return { title: "Receipt not found · MandateSeal" };
  const r = data.view;
  const title = `${r.decision} · ${r.actionType} · MandateSeal Receipt`;
  const description = `Agent ${data.agent.name}. Decision ${r.decision}. ${r.matchedRule}. Sealed at ${r.timestamp}.`;
  // OG / Twitter image is provided by the colocated opengraph-image.tsx
  // route — Next.js auto-injects the meta. summary_large_image so the
  // 1200×630 receipt card preview renders inline on Twitter / Telegram /
  // Farcaster / Discord.
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicReceiptPage({ params, searchParams }: PageProps) {
  const data = await loadReceipt(params.id);
  if (!data) notFound();

  // Verify uses the FULL stored payload (server-side only). The redacted
  // version is what we pass to client components.
  const verdict = recomputeAndVerify({ ...data.full, rawPayload: data.full.rawPayload ?? {} });
  const reEval = reEvaluateFromSnapshot({ ...data.full, rawPayload: data.full.rawPayload ?? {} });
  const r = data.view;
  const isEmbed = searchParams.embed === "1";

  if (isEmbed) {
    // Compact embeddable view — meant to be iframed into other sites. No
    // global nav / footer (those still render via layout), but we strip the
    // long-form quickstart copy and just show: verify pill + ReceiptCard.
    return (
      <div className="page-container py-6 max-w-3xl">
        <div className="font-tech text-[10px] uppercase tracking-[0.22em] text-paperMuted mb-3">
          &gt; mandateseal · public receipt · {verdict.valid ? "verified ✓" : "invalid ✗"}
        </div>
        <ReceiptCard receipt={r} />
        <div className="mt-3 font-tech text-[10px] uppercase tracking-[0.22em] text-paperMuted text-right">
          <Link href={`/r/${r.id}`} className="hover:text-paper">open full ↗</Link>
        </div>
      </div>
    );
  }

  const embedSrc = `/r/${r.id}?embed=1`;

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

      <div className="mt-6 ink-panel p-5">
        <div className="label">SHARE</div>
        <p className="mt-2 text-paperMuted text-sm">
          The 1200×630 OG image renders inline on Twitter, Farcaster, Telegram,
          and Discord. Use the download link to grab the PNG directly for
          slides / docs / status pages.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/r/${r.id}/opengraph-image`}
            download={`mandateseal-${r.id}.png`}
            className="command-button accent"
          >
            Download PNG
          </a>
          <a
            href={`https://twitter.com/intent/tweet?${new URLSearchParams({
              text: `${r.decision} · ${r.actionType} · ${r.matchedRule}\n\nSealed by MandateSeal:`,
            }).toString()}&url=${encodeURIComponent(`https://mandateseal.vercel.app/r/${r.id}`)}`}
            target="_blank"
            rel="noreferrer"
            className="command-button"
          >
            Tweet ↗
          </a>
          <a
            href={`https://warpcast.com/~/compose?${new URLSearchParams({
              text: `${r.decision} · ${r.actionType} · sealed by MandateSeal`,
              "embeds[]": `https://mandateseal.vercel.app/r/${r.id}`,
            }).toString()}`}
            target="_blank"
            rel="noreferrer"
            className="command-button"
          >
            Cast ↗
          </a>
        </div>
      </div>

      <div className="mt-6 ink-panel p-5">
        <div className="label">EMBED THIS RECEIPT</div>
        <p className="mt-2 text-paperMuted text-sm">
          Drop the iframe into any page; the embed view is chrome-light and renders the
          card + verified pill only. Resize the parent — the receipt scales with its container.
        </p>
        <pre className="mt-3 font-tech text-[11px] text-paper overflow-x-auto whitespace-pre">
{`<iframe
  src="${embedSrc}"
  width="100%"
  height="640"
  style="border:0"
  loading="lazy"
></iframe>`}
        </pre>
        <div className="mt-3">
          <Link
            href={embedSrc}
            target="_blank"
            rel="noreferrer"
            className="command-button"
          >
            Open Embed View ↗
          </Link>
        </div>
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
