import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { createWebhookSchema, publicWebhook } from "@/lib/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const webhooks = await prisma.webhook.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ webhooks: webhooks.map(publicWebhook) });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const wh = await prisma.webhook.create({
    data: {
      id: randomId("wh"),
      name: parsed.data.name,
      url: parsed.data.url,
      events: JSON.stringify(parsed.data.events),
      enabled: parsed.data.enabled,
    },
  });
  return NextResponse.json({ webhook: publicWebhook(wh) }, { status: 201 });
}
