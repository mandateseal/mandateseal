import { prisma } from "@/lib/db";
import { publicTool } from "@/lib/tool";
import { ToolsClient } from "@/components/ToolsClient";
import { SectionSubNav, INFRA_TABS } from "@/components/SectionSubNav";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const tools = await prisma.tool.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="page-container py-10">
      <div className="label">GATEWAY</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">TOOLS</h1>
      <SectionSubNav group="Infra" tabs={INFRA_TABS} active="/tools" />
      <p className="mt-4 text-paperMuted text-sm max-w-2xl">
        Register upstream HTTP endpoints. Agents call them through MandateSeal's policy-checked
        proxy at <code className="text-paper">/api/proxy/&lt;name&gt;</code>. Every invocation is
        sealed as a receipt before forwarding.
      </p>
      <div className="mt-6">
        <ToolsClient initial={tools.map(publicTool)} />
      </div>
    </div>
  );
}
