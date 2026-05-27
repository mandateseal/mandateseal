import Link from "next/link";
import { prisma } from "@/lib/db";
import { publicAgent } from "@/lib/serialize";
import { AgentRow } from "@/components/AgentRow";
import { SectionSubNav, AGENTS_TABS } from "@/components/SectionSubNav";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="page-container py-10">
      <div className="label">REGISTRY</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">AGENTS</h1>
      <SectionSubNav group="Agents" tabs={AGENTS_TABS} active="/agents" />
      <p className="mt-4 text-paperMuted text-sm max-w-2xl">
        Every autonomous agent registered with MandateSeal. Raw API keys are shown once at creation
        and once at rotation, never again.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard" className="command-button accent">Create / Manage on Dashboard</Link>
      </div>

      {agents.length === 0 ? (
        <div className="mt-8 paper-panel p-8 text-center">
          <div className="font-display text-paper text-xl tracking-[0.04em]">NO AGENTS YET</div>
          <p className="mt-3 text-paperMuted text-sm max-w-md mx-auto">
            Run <code className="text-paper">npm run db:seed</code> to provision the demo Atlas-01 agent,
            or use <code className="text-paper">POST /api/agents</code> / the dashboard to create one.
          </p>
          <div className="mt-5">
            <Link href="/dashboard" className="command-button accent">Open Dashboard</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 ink-panel overflow-x-auto">
          <table className="w-full font-tech text-[12px]">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3 label">NAME</th>
                <th className="px-4 py-3 label">ROLE</th>
                <th className="px-4 py-3 label">ID</th>
                <th className="px-4 py-3 label">STATUS</th>
                <th className="px-4 py-3 label">CREATED</th>
                <th className="px-4 py-3 label">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(publicAgent).map((a) => (
                <AgentRow key={a.id} agent={a} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
