-- v0.8.1: idempotency + per-tool quota + per-tool inputSchema

ALTER TABLE "Receipt" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Receipt" ADD COLUMN "requestHash"    TEXT;
CREATE UNIQUE INDEX "Receipt_agentId_idempotencyKey_key"
  ON "Receipt" ("agentId", "idempotencyKey");

ALTER TABLE "Tool" ADD COLUMN "quotaPerDay" INTEGER;
ALTER TABLE "Tool" ADD COLUMN "inputSchema" TEXT;
