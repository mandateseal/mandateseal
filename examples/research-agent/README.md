# research-agent (MandateSeal SDK example)

A minimal "autonomous research agent" that wraps every tool call with
`seal.guard()`. The agent's loop is just a scripted task list — swap it for
LangChain / Anthropic tool-use / AutoGen / your own loop and the policy
plumbing stays identical.

## What it shows

For each tool call:

1. Call `seal.guard(action, () => realTool())`.
2. MandateSeal evaluates the action against the agent's mandate.
3. If `APPROVED` → tool fires, receipt returned.
4. If `BLOCKED` → tool **never runs**, `MandateSealError` thrown with the matched rule.
5. If `NEEDS_APPROVAL` → SDK long-polls until a human resolves it in the dashboard, then either fires the tool or throws.

The 5 scripted tasks cover all three outcomes:

| # | Task                                  | Outcome           |
|---|---------------------------------------|-------------------|
| 1 | search github.com                     | APPROVED          |
| 2 | summarize via OpenAI ($1.20)          | APPROVED          |
| 3 | draft email                           | NEEDS_APPROVAL    |
| 4 | shell exec `rm -rf`                   | BLOCKED (tool)    |
| 5 | transfer 50 USDC                      | BLOCKED (action)  |

## Run

Against the hosted MandateSeal:

```bash
MANDATESEAL_URL=https://mandateseal.tech \
MANDATESEAL_API_KEY=msk_demo_9208ef5a720cb016e980823de1b04425a42e891c \
npm run example:research-agent
```

Or against a local server (`npm run dev` running in another terminal):

```bash
MANDATESEAL_URL=http://localhost:3000 \
MANDATESEAL_API_KEY=msk_demo_... \
npm run example:research-agent
```

The receipts created by this run show up in the dashboard at
`<MANDATESEAL_URL>/receipts`.

## Expected output

```
MandateSeal research-agent example
  base   : https://mandateseal.tech
  agent  : agent_atlas_01

[01] search github for autonomous-agent papers ... ✓ APPROVED  rct_xxxxxxxxxxxxxxxxxxxx
     hash  59eb0e7d70ed4aef…
[02] summarize a paper via OpenAI ... ✓ APPROVED  rct_xxxxxxxxxxxxxxxxxxxx
     hash  ab12cd34ef56789a…
[03] draft an email to the author ... ? NEEDS_APPROVAL (timed out or denied)
     hash  fedcba9876543210…
     reason action denied — pending human review
[04] clean up cache via shell ... ✗ BLOCKED
     hash  00112233445566aa…
     reason Tool "shell_exec" is on the mandate's block list.
[05] transfer 50 USDC to a wallet ... ✗ BLOCKED
     hash  bbccdd112233aabb…
     reason Action "transfer_usdc" is on the mandate's block list.

summary: 2 approved · 2 blocked · 1 needs-approval
```

## The pattern

```ts
import { MandateSeal } from "mandateseal/sdk";

const seal = new MandateSeal({
  baseUrl: process.env.MANDATESEAL_URL!,
  apiKey:  process.env.MANDATESEAL_API_KEY!,
});

// Anywhere you'd call a tool, wrap it.
const { value, receipt } = await seal.guard(
  {
    agentId: "agent_atlas_01",
    actionType: "summarize",
    tool: "paid_api_call",
    target: "api.openai.com",
    costUsd: 1.2,
  },
  () => openai.chat.completions.create({ model: "gpt-4o", messages: [...] }),
);
```

That's it. Every guarded call leaves a signed receipt; over time, batches get
merkle-rooted and broadcast onchain so an auditor can verify the agent's
behavior from a public chain.
