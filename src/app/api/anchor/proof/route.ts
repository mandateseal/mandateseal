import { NextResponse } from "next/server";
import { buildAnchorProof } from "@/lib/anchor";

export const runtime = "nodejs";

// GET /api/anchor/proof?receiptId=…
export async function GET(req: Request) {
  const url = new URL(req.url);
  const receiptId = url.searchParams.get("receiptId");
  if (!receiptId) {
    return NextResponse.json({ error: "receiptId is required" }, { status: 400 });
  }
  const proof = await buildAnchorProof(receiptId);
  if (!proof) {
    return NextResponse.json({ error: "Receipt not found or not anchored yet" }, { status: 404 });
  }
  return NextResponse.json(proof);
}
