import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { DEFAULT_AGENT, DEFAULT_MANDATE } from "../src/lib/constants";

const prisma = new PrismaClient();

function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

async function main() {
  const existing = await prisma.agent.findUnique({ where: { id: DEFAULT_AGENT.id } });
  if (existing) {
    console.log("[seed] default agent already exists, skipping");
    return;
  }

  const rawKey = "msk_demo_" + randomBytes(20).toString("hex");
  const apiKeyHash = hashApiKey(rawKey);

  await prisma.agent.create({
    data: {
      id: DEFAULT_AGENT.id,
      name: DEFAULT_AGENT.name,
      role: DEFAULT_AGENT.role,
      apiKeyHash,
      status: "active",
    },
  });

  await prisma.mandate.create({
    data: {
      id: DEFAULT_MANDATE.id,
      agentId: DEFAULT_AGENT.id,
      name: DEFAULT_MANDATE.name,
      enabled: DEFAULT_MANDATE.enabled,
      dailyBudgetUsd: DEFAULT_MANDATE.dailyBudgetUsd,
      maxCostPerActionUsd: DEFAULT_MANDATE.maxCostPerActionUsd,
      approvalThresholdUsd: DEFAULT_MANDATE.approvalThresholdUsd,
      allowedTools: JSON.stringify(DEFAULT_MANDATE.allowedTools),
      blockedTools: JSON.stringify(DEFAULT_MANDATE.blockedTools),
      blockedActions: JSON.stringify(DEFAULT_MANDATE.blockedActions),
      approvalRequiredActions: JSON.stringify(DEFAULT_MANDATE.approvalRequiredActions),
      allowedDomains: JSON.stringify(DEFAULT_MANDATE.allowedDomains),
      blockedDomains: JSON.stringify(DEFAULT_MANDATE.blockedDomains),
    },
  });

  console.log("[seed] created default agent + mandate");
  console.log("[seed] DEMO API KEY (save this, shown once):");
  console.log("        " + rawKey);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
