-- v0.8.3 — recipient allow-list (mirror of allowedContracts / C7), for payouts
-- that should only ever pay a fixed set of addresses. Additive column with a
-- safe default: legacy mandates keep working unchanged (empty list = the rule
-- never fires). Adding a NOT NULL column WITH a constant default is a metadata-
-- only change on PostgreSQL 11+ (no table rewrite, no long lock).
ALTER TABLE "Mandate" ADD COLUMN "allowedRecipients" TEXT NOT NULL DEFAULT '[]';
