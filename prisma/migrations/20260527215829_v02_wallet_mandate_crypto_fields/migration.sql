-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "agentWallet" TEXT,
ADD COLUMN     "allowedChains" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "allowedContracts" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "allowedTokens" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "blockedContracts" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "blockedRecipients" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "dailyTokenSpendUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "maxTxValueUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ownerWallet" TEXT,
ADD COLUMN     "requireApprovalForSwaps" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireApprovalForTransfers" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "amount" TEXT,
ADD COLUMN     "chain" TEXT,
ADD COLUMN     "contractAddress" TEXT,
ADD COLUMN     "functionSelector" TEXT,
ADD COLUMN     "recipient" TEXT,
ADD COLUMN     "token" TEXT,
ADD COLUMN     "txHash" TEXT,
ADD COLUMN     "txValueUsd" DOUBLE PRECISION,
ADD COLUMN     "wallet" TEXT;
