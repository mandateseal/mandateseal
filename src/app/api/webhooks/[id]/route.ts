import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicWebhook, updateWebhookSchema } from "@/lib/webhook";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const wh = await prisma.webhook.findUnique({ where: { id: params.id } });
  if (!wh) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  return NextResponse.json({ webhook: publicWebhook(wh) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const existing = await prisma.webhook.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.url !== undefined) data.url = parsed.data.url;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.events !== undefined) data.events = JSON.stringify(parsed.data.events);

  const wh = await prisma.webhook.update({ where: { id: params.id }, data });
  return NextResponse.json({ webhook: publicWebhook(wh) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const existing = await prisma.webhook.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  await prisma.webhook.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
