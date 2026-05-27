import { prisma } from "@/lib/db";
import { publicBatch } from "@/lib/anchor";
import { isAnchorConfigured } from "@/lib/onchain";
import { AnchorClient } from "@/components/AnchorClient";
import { SectionSubNav, INFRA_TABS } from "@/components/SectionSubNav";

export const dynamic = "force-dynamic";

export default async function AnchorPage() {
  const [batches, pending] = await Promise.all([
    prisma.anchorBatch.findMany({ orderBy: { batchIndex: "desc" }, take: 100 }),
    prisma.receipt.count({ where: { anchorBatchId: null } }),
  ]);
  const onchainConfigured = isAnchorConfigured();
  return (
    <div className="page-container py-10">
      <div className="label">CHAIN</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">ANCHOR</h1>
      <SectionSubNav group="Infra" tabs={INFRA_TABS} active="/anchor" />
      <p className="mt-4 text-paperMuted text-sm max-w-2xl">
        Bundle receipts into merkle trees. Every batch's root is linked to the previous batch's
        root, forming a tamper-evident chain.
        {onchainConfigured
          ? " Each new batch is broadcast to Base as a 0-value tx whose calldata embeds (batchIndex, prevRoot, root). Anyone can verify the anchor from the public chain — no server trust required."
          : " Set MANDATESEAL_ANCHOR_* env vars to broadcast each root onchain. Until then, batches stay local-only and trust ends at MandateSeal's signing key."}
      </p>
      <div className="mt-6">
        <AnchorClient
          initialBatches={batches.map(publicBatch)}
          initialPending={pending}
          onchainConfigured={onchainConfigured}
        />
      </div>
    </div>
  );
}
