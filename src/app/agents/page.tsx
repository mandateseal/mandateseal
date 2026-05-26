import Link from "next/link";
import { prisma } from "@/lib/db";
import { publicAgent } from "@/lib/serialize";
import { fmtTimestamp } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="page-container py-10">
      <div className="label">REGISTRY</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">AGENTS</h1>
      <p className="mt-2 text-paperMuted text-sm">
        Every autonomous agent registered with MandateSeal. Raw API keys are shown once at creation
        and never again.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard" className="command-button accent">Create / Manage on Dashboard</Link>
      </div>

      <div className="mt-6 ink-panel overflow-x-auto">
        <table className="w-full font-tech text-[12px]">
          <thead>
            <tr className="text-left">
              <th className="px-4 py-3 label">NAME</th>
              <th className="px-4 py-3 label">ROLE</th>
              <th className="px-4 py-3 label">ID</th>
              <th className="px-4 py-3 label">STATUS</th>
              <th className="px-4 py-3 label">CREATED</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-paperMuted">
                  No agents yet. Run <code>npm run setup</code> to seed Atlas-01.
                </td>
              </tr>
            )}
            {agents.map(publicAgent).map((a) => (
              <tr key={a.id} className="border-t border-line text-paper">
                <td className="px-4 py-3">{a.name}</td>
                <td className="px-4 py-3">{a.role}</td>
                <td className="px-4 py-3"><code className="text-paperMuted">{a.id}</code></td>
                <td className="px-4 py-3 text-green">● {a.status}</td>
                <td className="px-4 py-3 text-paperMuted">{fmtTimestamp(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
