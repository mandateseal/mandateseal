import { prisma } from "@/lib/db";
import { publicBatch } from "@/lib/anchor";
import { AnchorClient } from "@/components/AnchorClient";
import { SectionSubNav, INFRA_TABS } from "@/components/SectionSubNav";

export const dynamic = "force-dynamic";

export default async function AnchorPage() {
  const [batches, pending] = await Promise.all([
    prisma.anchorBatch.findMany({ orderBy: { batchIndex: "desc" }, take: 100 }),
    prisma.receipt.count({ where: { anchorBatchId: null } }),
  ]);
  return (
    <div className="page-container py-10">
      <div className="label">CHAIN</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">ANCHOR</h1>
      <SectionSubNav group="Infra" tabs={INFRA_TABS} active="/anchor" />
      <p className="mt-4 text-paperMuted text-sm max-w-2xl">
        Bundle receipts into merkle trees. Every batch's root is linked to the previous batch's
        root, forming a tamper-evident chain. v0.9.1 will broadcast each root to Base — until
        then, this is structural preparation. Trust still ends at MandateSeal's signing key.
      </p>
      <div className="mt-6">
        <AnchorClient initialBatches={batches.map(publicBatch)} initialPending={pending} />
      </div>
    </div>
  );
}
