export default function DocsPage() {
  return (
    <div className="page-container py-10 max-w-4xl">
      <div className="label">QUICKSTART</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">DOCS</h1>
      <p className="mt-2 text-paperMuted text-sm">
        Five minutes to your first signed agent receipt — onchain or off.
      </p>

      <Section n="01" title="Install & seed">
        <Pre>{`npm install
npm run setup        # prisma generate + db push + seed default Atlas-01
npm run dev`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          The seed prints a demo API key to your terminal. Save it — it is hashed and discarded.
        </p>
      </Section>

      <Section n="02" title="Create an agent">
        <Pre>{`curl -X POST http://localhost:3000/api/agents \\
  -H "content-type: application/json" \\
  -d '{ "name": "Atlas-02", "role": "Onchain research agent" }'`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          The response contains <code>apiKey</code> — shown once, never again.
        </p>
      </Section>

      <Section n="03" title="Create a wallet mandate">
        <Pre>{`curl -X POST http://localhost:3000/api/mandates \\
  -H "content-type: application/json" \\
  -d '{
    "agentId": "agent_xxx",
    "name": "research-budget-v1",
    "dailyBudgetUsd": 25,
    "maxCostPerActionUsd": 2,
    "approvalThresholdUsd": 5,
    "allowedTools": ["paid_api_call","web_search"],
    "blockedTools": ["shell_exec"],
    "allowedDomains": ["api.openai.com"],

    "agentWallet":  "0xa4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4",
    "ownerWallet":  "0xfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfbfb",
    "allowedChains":   ["base","base-sepolia"],
    "allowedTokens":   ["USDC","ETH"],
    "allowedContracts":["0x1111111111111111111111111111111111111111"],
    "blockedRecipients":["0xdedededededededededededededededededededede"],
    "maxTxValueUsd": 200,
    "dailyTokenSpendUsd": 500,
    "requireApprovalForSwaps": true,
    "requireApprovalForTransfers": false
  }'`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          Wallet fields are optional. Mandates without them still work for off-chain agents.
        </p>
      </Section>

      <Section n="04" title="Preflight check — USDC transfer">
        <Pre>{`curl -X POST http://localhost:3000/api/check \\
  -H "Authorization: Bearer msk_xxx" \\
  -H "content-type: application/json" \\
  -d '{
    "agentId":     "agent_xxx",
    "actionType":  "transfer_usdc",
    "tool":        "wallet",
    "target":      "0xababababababababababababababababababababab",
    "chain":       "base",
    "token":       "USDC",
    "amount":      "25000000",
    "txValueUsd":  25,
    "recipient":   "0xababababababababababababababababababababab"
  }'`}</Pre>
      </Section>

      <Section n="05" title="Preflight check — token swap">
        <Pre>{`curl -X POST http://localhost:3000/api/check \\
  -H "Authorization: Bearer msk_xxx" \\
  -H "content-type: application/json" \\
  -d '{
    "agentId":         "agent_xxx",
    "actionType":      "token_swap",
    "tool":            "dex",
    "target":          "0x1111111111111111111111111111111111111111",
    "chain":           "base",
    "token":           "ETH",
    "amount":          "1000000000000000",
    "txValueUsd":      3.5,
    "contractAddress": "0x1111111111111111111111111111111111111111",
    "functionSelector":"0x38ed1739"
  }'`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          With <code>requireApprovalForSwaps: true</code>, this returns <code>NEEDS_APPROVAL</code> and creates an approval handle the SDK can long-poll.
        </p>
      </Section>

      <Section n="06" title="Preflight check — contract call">
        <Pre>{`curl -X POST http://localhost:3000/api/check \\
  -H "Authorization: Bearer msk_xxx" \\
  -H "content-type: application/json" \\
  -d '{
    "agentId":         "agent_xxx",
    "actionType":      "contract_call",
    "tool":            "wallet",
    "target":          "0x2222222222222222222222222222222222222222",
    "chain":           "base",
    "contractAddress": "0x2222222222222222222222222222222222222222",
    "functionSelector":"0xdeadbeef"
  }'`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          Unknown selectors route to <code>NEEDS_APPROVAL</code>. Known safe selectors (ERC20 transfer / approve / balanceOf) auto-approve.
        </p>
      </Section>

      <Section n="07" title="Verify a receipt">
        <Pre>{`curl -X POST http://localhost:3000/api/verify \\
  -H "content-type: application/json" \\
  -d '{ "id": "rct_xxxxxx" }'`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          Or POST the full receipt JSON. Returns <code>{`{ "valid": true | false, "reasons": [...] }`}</code>.
        </p>
      </Section>

      <Section n="08" title="Public proof page">
        <Pre>{`https://your-deploy.example.com/r/<receiptId>`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          Every receipt has a public, share-safe page (raw payload redacted).
          Once the receipt's batch is anchored onchain, the page links the BaseScan tx
          carrying the merkle root — third parties can verify the receipt without
          ever talking to MandateSeal.
        </p>
      </Section>

      <Section n="09" title="TypeScript SDK">
        <Pre>{`import { MandateSeal } from "@/sdk/mandateseal";

const seal = new MandateSeal({
  apiKey:  process.env.MANDATESEAL_API_KEY!,
  baseUrl: "http://localhost:3000",
});

const result = await seal.check({
  agentId:    "agent_atlas_01",
  actionType: "transfer_usdc",
  tool:       "wallet",
  target:     "0xababababababababababababababababababababab",
  chain:      "base",
  token:      "USDC",
  amount:     "25000000",
  txValueUsd: 25,
  recipient:  "0xababababababababababababababababababababab",
});

if (result.decision !== "APPROVED") throw new Error(result.reason);

// fire the real onchain tx...

const proof = await seal.verifyReceipt(result.receipt);
if (!proof.valid) throw new Error("receipt tampered with");`}</Pre>
      </Section>

      <Section n="10" title="Policy engine — rule order">
        <ol className="list-decimal pl-6 mt-2 space-y-1 text-paper text-sm">
          <li>If mandate is disabled → APPROVED.</li>
          <li>Tool in <code>blockedTools</code> → BLOCKED.</li>
          <li>actionType in <code>blockedActions</code> → BLOCKED.</li>
          <li>Recipient in <code>blockedRecipients</code> → BLOCKED.</li>
          <li>Contract in <code>blockedContracts</code> → BLOCKED.</li>
          <li>Chain not in <code>allowedChains</code> → BLOCKED.</li>
          <li>Token not in <code>allowedTokens</code> → BLOCKED.</li>
          <li><code>txValueUsd</code> {">"} <code>maxTxValueUsd</code> → BLOCKED.</li>
          <li>Infinite token approval → BLOCKED.</li>
          <li>Contract not in <code>allowedContracts</code> → BLOCKED.</li>
          <li>Target domain in <code>blockedDomains</code> → BLOCKED.</li>
          <li>cost {">"} <code>maxCostPerActionUsd</code> → BLOCKED.</li>
          <li>cost {">"} <code>approvalThresholdUsd</code> → NEEDS_APPROVAL.</li>
          <li>actionType in <code>approvalRequiredActions</code> → NEEDS_APPROVAL.</li>
          <li>token_swap + <code>requireApprovalForSwaps</code> → NEEDS_APPROVAL.</li>
          <li>transfer + <code>requireApprovalForTransfers</code> → NEEDS_APPROVAL.</li>
          <li>contract_call + unknown selector → NEEDS_APPROVAL.</li>
          <li>If <code>allowedTools</code> non-empty and tool not in it → BLOCKED.</li>
          <li>If <code>allowedDomains</code> non-empty and target not in it → BLOCKED.</li>
          <li>Otherwise → APPROVED.</li>
        </ol>
      </Section>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="font-tech text-[10px] text-paperMuted tracking-[0.22em]">// {n}</div>
      <h2 className="font-display text-paper text-2xl tracking-[0.04em] mt-1">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="ink-panel p-4 font-tech text-[12px] text-paper overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}
