import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { publicAgent, publicMandate, publicReceipt } from "@/lib/serialize";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: "asc" } });
  const activeAgent = agents[0] ?? null;
  const mandate = activeAgent
    ? await prisma.mandate.findFirst({
        where: { agentId: activeAgent.id },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const receipts = activeAgent
    ? await prisma.receipt.findMany({
        where: { agentId: activeAgent.id },
        orderBy: { timestamp: "desc" },
        take: 100,
      })
    : [];

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  return (
    <DashboardClient
      baseUrl={baseUrl}
      initial={{
        agents: agents.map(publicAgent),
        activeAgentId: activeAgent?.id ?? null,
        mandate: mandate ? publicMandate(mandate) : null,
        receipts: receipts.map(publicReceipt),
      }}
    />
  );
}
