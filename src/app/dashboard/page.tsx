import { prisma } from "@/lib/db";
import { publicAgent, publicMandate, publicReceipt } from "@/lib/serialize";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const agent = await prisma.agent.findFirst({ orderBy: { createdAt: "asc" } });
  const mandate = agent
    ? await prisma.mandate.findFirst({
        where: { agentId: agent.id },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const receipts = agent
    ? await prisma.receipt.findMany({
        where: { agentId: agent.id },
        orderBy: { timestamp: "desc" },
        take: 100,
      })
    : [];

  return (
    <DashboardClient
      initial={{
        agent: agent ? publicAgent(agent) : null,
        mandate: mandate ? publicMandate(mandate) : null,
        freshApiKey: null,
        receipts: receipts.map(publicReceipt),
      }}
    />
  );
}
