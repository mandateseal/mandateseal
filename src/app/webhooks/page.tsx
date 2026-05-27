import { prisma } from "@/lib/db";
import { publicWebhook, publicDelivery } from "@/lib/webhook";
import { WebhooksClient } from "@/components/WebhooksClient";
import { SectionSubNav, INFRA_TABS } from "@/components/SectionSubNav";

export const dynamic = "force-dynamic";

const RECENT_DELIVERIES = 50;

export default async function WebhooksPage() {
  const [webhooks, deliveries] = await Promise.all([
    prisma.webhook.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.webhookDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_DELIVERIES,
    }),
  ]);

  return (
    <div className="page-container py-10">
      <div className="label">NOTIFICATIONS</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">WEBHOOKS</h1>
      <SectionSubNav group="Infra" tabs={INFRA_TABS} active="/webhooks" />
      <p className="mt-4 text-paperMuted text-sm max-w-2xl">
        Push instead of poll. MandateSeal POSTs signed JSON to your URL when receipts seal,
        decisions block, or approvals resolve. 4 attempts with exponential backoff.
      </p>
      <div className="mt-6">
        <WebhooksClient
          initialWebhooks={webhooks.map(publicWebhook)}
          initialDeliveries={deliveries.map(publicDelivery)}
        />
      </div>
    </div>
  );
}
