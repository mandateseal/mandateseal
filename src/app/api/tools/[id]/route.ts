import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicTool, updateToolSchema } from "@/lib/tool";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tool = await prisma.tool.findFirst({
    where: { OR: [{ id: params.id }, { name: params.id }] },
  });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  return NextResponse.json({ tool: publicTool(tool) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateToolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const existing = await prisma.tool.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  const updated = await prisma.tool.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json({ tool: publicTool(updated) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const existing = await prisma.tool.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  await prisma.tool.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
