import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { actionRequestSchema } from "@/lib/schemas";
import { evaluateAndSeal } from "@/lib/receipt";
import { publicReceipt } from "@/lib/serialize";
import { parseReceiptFilter, toPrismaWhere } from "@/lib/receipt-filter";

export const runtime = "nodejs";

const CSV_COLUMNS = [
  "id",
  "timestamp",
  "agentId",
  "mandateId",
  "decision",
  "riskLevel",
  "actionType",
  "tool",
  "target",
  "costUsd",
  "matchedRule",
  "reason",
  "policyHash",
  "receiptHash",
  "signature",
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = parseReceiptFilter(url.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const where = toPrismaWhere(parsed.filter);
  const limit = parsed.filter.limit ?? 100;
  const offset = parsed.filter.offset ?? 0;

  const format = url.searchParams.get("format") ?? "json";

  if (format === "csv") {
    // For CSV we ignore offset/limit caps and stream everything matching the filter,
    // but still bound the result for safety. Finance workflows typically want all rows.
    const csvLimit = Math.min(parsed.filter.limit ?? 50_000, 50_000);
    const rows = await prisma.receipt.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: csvLimit,
    });
    const header = CSV_COLUMNS.join(",");
    const body = rows.map((r) => {
      const v = publicReceipt(r) as unknown as Record<string, unknown>;
      return CSV_COLUMNS.map((c) => csvEscape(v[c])).join(",");
    });
    // Prepend UTF-8 BOM so Excel on Windows decodes Unicode chars (∋, →, ·)
    // correctly. Google Sheets / LibreOffice / Numbers handle UTF-8 fine either way.
    const csv = "﻿" + [header, ...body].join("\n") + "\n";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="mandateseal-receipts-${Date.now()}.csv"`,
      },
    });
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.receipt.count({ where }),
  ]);

  return NextResponse.json({
    receipts: receipts.map(publicReceipt),
    pagination: { limit, offset, total, returned: receipts.length },
  });
}

// Manual receipt generation (e.g. from the dashboard simulator). Uses agentId
// from body, no bearer required. /api/check is the auth-protected path.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const receipt = await evaluateAndSeal(parsed.data);
    return NextResponse.json({ receipt }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
