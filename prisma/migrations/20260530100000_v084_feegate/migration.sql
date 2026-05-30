-- v0.8.4 — fee-gate (token utility), shipped dark behind FEE_GATE_ENABLED.
-- Additive only; legacy mandates keep working (ownerWalletVerified defaults
-- false, and with no Entitlement rows there are no credits — but the gate stays
-- off entirely unless the env flag is on).

-- (1) verified-owner flag on the mandate, set by the wallet-verify (SIWE) endpoint.
ALTER TABLE "Mandate" ADD COLUMN "ownerWalletVerified" BOOLEAN NOT NULL DEFAULT false;

-- (2) prepaid-credit ledger per owner wallet (granted by the FeeVault deposit
--     indexer, consumed by metered paid actions). remaining = granted - consumed.
CREATE TABLE "Entitlement" (
    "ownerWallet" TEXT NOT NULL,
    "granted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("ownerWallet")
);
