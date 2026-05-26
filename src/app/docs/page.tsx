export default function DocsPage() {
  return (
    <div className="page-container py-10 max-w-4xl">
      <div className="label">QUICKSTART</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">DOCS</h1>
      <p className="mt-2 text-paperMuted text-sm">
        Five minutes to your first signed receipt.
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
  -d '{ "name": "Atlas-02", "role": "Research agent" }'`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          The response contains <code>apiKey</code> — shown once, never again.
        </p>
      </Section>

      <Section n="03" title="Create / update a mandate">
        <Pre>{`curl -X POST http://localhost:3000/api/mandates \\
  -H "content-type: application/json" \\
  -d '{
    "agentId": "agent_xxx",
    "name": "research-budget-v1",
    "dailyBudgetUsd": 25,
    "maxCostPerActionUsd": 2,
    "approvalThresholdUsd": 5,
    "allowedTools": ["paid_api_call","web_search"],
    "blockedTools": ["wallet_transfer","shell_exec"],
    "blockedActions": ["transfer_usdc","delete_files"],
    "approvalRequiredActions": ["send_email"],
    "allowedDomains": ["api.openai.com"],
    "blockedDomains": ["unknown-wallet.site"]
  }'`}</Pre>
      </Section>

      <Section n="04" title="Preflight check (the wire contract)">
        <Pre>{`curl -X POST http://localhost:3000/api/check \\
  -H "Authorization: Bearer msk_xxx" \\
  -H "content-type: application/json" \\
  -d '{
    "agentId": "agent_xxx",
    "actionType": "paid_api_call",
    "tool": "paid_api_call",
    "target": "https://api.openai.com/v1/responses",
    "costUsd": 0.02
  }'`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          Returns <code>decision</code> (APPROVED · BLOCKED · NEEDS_APPROVAL), <code>reason</code>,
          <code> matchedRule</code>, <code>riskLevel</code>, and the full signed <code>receipt</code>.
        </p>
      </Section>

      <Section n="05" title="Verify a receipt">
        <Pre>{`curl -X POST http://localhost:3000/api/verify \\
  -H "content-type: application/json" \\
  -d '{ "id": "rct_xxxxxx" }'`}</Pre>
        <p className="mt-3 text-paperMuted text-sm">
          Or POST the full receipt JSON. Returns <code>{`{ "valid": true | false, "reasons": [...] }`}</code>.
        </p>
      </Section>

      <Section n="06" title="TypeScript SDK">
        <Pre>{`import { MandateSeal } from "@/sdk/mandateseal";

const seal = new MandateSeal({
  apiKey: process.env.MANDATESEAL_API_KEY!,
  baseUrl: "http://localhost:3000",
});

const result = await seal.check({
  agentId: "agent_atlas_01",
  actionType: "paid_api_call",
  tool: "paid_api_call",
  target: "https://api.openai.com/v1/responses",
  costUsd: 0.02,
});

if (result.decision !== "APPROVED") {
  throw new Error(result.reason);
}

// run your action…

const proof = await seal.verifyReceipt(result.receipt);
if (!proof.valid) throw new Error("receipt tampered with");`}</Pre>
      </Section>

      <Section n="07" title="Policy engine — rules in order">
        <ol className="list-decimal pl-6 mt-2 space-y-1 text-paper text-sm">
          <li>If mandate is disabled → APPROVED.</li>
          <li>Tool in <code>blockedTools</code> → BLOCKED.</li>
          <li>actionType in <code>blockedActions</code> → BLOCKED.</li>
          <li>Target domain in <code>blockedDomains</code> → BLOCKED.</li>
          <li>cost {">"} <code>maxCostPerActionUsd</code> → BLOCKED.</li>
          <li>cost {">"} <code>approvalThresholdUsd</code> → NEEDS_APPROVAL.</li>
          <li>actionType in <code>approvalRequiredActions</code> → NEEDS_APPROVAL.</li>
          <li>If <code>allowedTools</code> is non-empty and tool not in it → BLOCKED.</li>
          <li>If <code>allowedDomains</code> is non-empty and target not in it → BLOCKED.</li>
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
