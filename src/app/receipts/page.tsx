import { prisma } from "@/lib/db";
import { publicReceipt } from "@/lib/serialize";
import { ReceiptTable } from "@/components/ReceiptTable";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const receipts = await prisma.receipt.findMany({
    orderBy: { timestamp: "desc" },
    take: 200,
  });
  return (
    <div className="page-container py-10">
      <div className="label">ARCHIVE</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">RECEIPTS</h1>
      <p className="mt-2 text-paperMuted text-sm">
        Every decision MandateSeal has produced. Each row is a signed, verifiable receipt.
      </p>
      <div className="mt-6">
        <ReceiptTable rows={receipts.map(publicReceipt)} />
      </div>
    </div>
  );
}
