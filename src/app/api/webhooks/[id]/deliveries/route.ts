import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicDelivery } from "@/lib/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50") || 50, 500);
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: params.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ deliveries: deliveries.map(publicDelivery) });
}
