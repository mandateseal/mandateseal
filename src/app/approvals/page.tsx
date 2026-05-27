import Link from "next/link";
import { prisma } from "@/lib/db";
import { expireAllOverdue, toApprovalListItem } from "@/lib/approval";
import { ApprovalRow } from "@/components/ApprovalRow";
import { SectionSubNav, LOGS_TABS } from "@/components/SectionSubNav";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  await expireAllOverdue();

  const [pending, recent] = await Promise.all([
    prisma.approval.findMany({
      where: { status: "pending" },
      orderBy: { requestedAt: "desc" },
      include: { receipt: true },
    }),
    prisma.approval.findMany({
      where: { status: { not: "pending" } },
      orderBy: { decidedAt: "desc" },
      take: 30,
      include: { receipt: true },
    }),
  ]);

  return (
    <div className="page-container py-10">
      <div className="label">QUEUE</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">APPROVALS</h1>
      <SectionSubNav group="Logs" tabs={LOGS_TABS} active="/approvals" />
      <p className="mt-4 text-paperMuted text-sm max-w-2xl">
        Every action sealed as <code className="text-paper">NEEDS_APPROVAL</code> lands here for a
        human to approve or deny. Decisions are recorded on the original receipt's audit trail.
      </p>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-paper text-xl tracking-[0.04em]">
            PENDING <span className="text-amber">·{pending.length}</span>
          </h2>
        </div>

        {pending.length === 0 ? (
          <div className="paper-panel p-8 text-center">
            <div className="font-display text-paper text-xl tracking-[0.04em]">QUEUE EMPTY</div>
            <p className="mt-3 text-paperMuted text-sm max-w-md mx-auto">
              No pending approvals. Trigger one by running an action that hits the mandate's{" "}
              <code className="text-paper">approvalRequiredActions</code> or exceeds the{" "}
              <code className="text-paper">approvalThresholdUsd</code>.
            </p>
            <div className="mt-5">
              <Link href="/dashboard" className="command-button accent">Open Dashboard</Link>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {pending.map((a) => (
              <ApprovalRow key={a.id} approval={toApprovalListItem(a)} />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-paper text-xl tracking-[0.04em] mb-3">
            RECENTLY RESOLVED <span className="text-paperMuted">· {recent.length}</span>
          </h2>
          <div className="grid lg:grid-cols-2 gap-4">
            {recent.map((a) => (
              <ApprovalRow key={a.id} approval={toApprovalListItem(a)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
