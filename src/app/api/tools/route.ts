import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { createToolSchema, publicTool } from "@/lib/tool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tools = await prisma.tool.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ tools: tools.map(publicTool) });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createToolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const existing = await prisma.tool.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: `Tool "${parsed.data.name}" already exists` }, { status: 409 });
  }
  const tool = await prisma.tool.create({
    data: {
      id: randomId("tool"),
      name: parsed.data.name,
      description: parsed.data.description,
      kind: parsed.data.kind,
      endpoint: parsed.data.endpoint,
      method: parsed.data.method,
      defaultCostUsd: parsed.data.defaultCostUsd,
      enabled: parsed.data.enabled,
    },
  });
  return NextResponse.json({ tool: publicTool(tool) }, { status: 201 });
}
