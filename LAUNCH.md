# MandateSeal — Launch Kit

Copy-paste-ready artifacts for launching MandateSeal publicly.
Each block has been written to fit the platform's character limit
and lead with the strongest hook for that audience.

---

## Tweet thread (X / Twitter)

> 1/ 🔏 Shipping MandateSeal — a permission and proof layer for autonomous crypto agents.
>
> Every action your agent attempts is checked against a wallet mandate **before** it runs, and sealed into a signed receipt **after**. Both halves verifiable from a public chain.
>
> Live: https://mandateseal.vercel.app

> 2/ The problem: agents are getting wallets. Trading bots, DAO treasurers, MCP tool callers.
>
> "Trust the prompt" isn't a strategy. You need:
> – a mandate the agent *can't* talk its way around
> – a receipt every action leaves behind
> – proof anyone can verify

> 3/ How it works:
>
> POST /api/check {
>   actionType: "transfer_usdc",
>   chain: "base", token: "USDC",
>   amount: "25000000",
>   txValueUsd: 25,
>   recipient: "0xabab..."
> }
>
> → APPROVED / BLOCKED / NEEDS_APPROVAL
> → Ed25519-signed receipt
> → merkle-batched, anchored to Base

> 4/ Wallet mandates that map to how agents actually fail:
>
> ✅ allowedChains, allowedTokens, allowedContracts
> ✅ blockedRecipients (drainer addrs), blockedContracts
> ✅ maxTxValueUsd, dailyTokenSpendUsd
> ✅ requireApprovalForSwaps / Transfers
> ✅ infinite token approvals → BLOCKED outright

> 5/ Want to see the policy engine fire?
>
> Open the playground — a scripted autonomous agent runs 8 actions, MandateSeal evaluates each in real time:
>
> https://mandateseal.vercel.app/playground

> 6/ MandateSeal is an MCP server too.
>
> Point Claude Desktop / Claude Code / Cursor at https://mandateseal.vercel.app/api/mcp — every tools/call gets two sealed receipts (preflight + outcome) and the receipt ids flow back via _meta.
>
> Sample config in the docs.

> 7/ Receipts get bundled into merkle batches; each root broadcast to Base as a 0-value tx.
>
> Want to verify a receipt? Fetch the tx, slice the calldata, recompute.
> No MandateSeal contact needed.
>
> Latest batch: https://sepolia.basescan.org/tx/0xc685256d59821c539d4fe38e20c76f58b86e3d82fb259ebd1542cc212ff45448

> 8/ What's NOT in v0.8.1:
>
> ❌ tokens / coin (not yet — product-market-fit first)
> ❌ multi-tenant workspaces (v1.0)
> ❌ MandateSeal-signed tx broadcasting (caller still signs)
> ❌ smart-contract-deployed verifier (just receipts for now)

> 9/ Try it:
> – playground: https://mandateseal.vercel.app/playground
> – docs:       https://mandateseal.vercel.app/docs
> – source:     https://github.com/mandateseal/mandateseal
>
> 🔏 approve before. prove after.

---

## Single tweet (high-density variant)

> 🔏 MandateSeal: permission + proof layer for autonomous crypto agents.
>
> Wallet mandates → preflight check → signed receipt → merkle batch → Base anchor.
>
> Also an MCP server — point Claude Code at /api/mcp.
>
> Play: https://mandateseal.vercel.app/playground

---

## Farcaster cast

> 🔏 launching MandateSeal — a permission + proof layer for autonomous crypto agents.
>
> agent attempts onchain action → MandateSeal checks against wallet mandate (chains, tokens, contracts, recipients, tx caps, approval gates) → returns APPROVED/BLOCKED/NEEDS_APPROVAL → Ed25519-signed receipt → merkle-anchored to Base.
>
> also an MCP server. Claude Code / Cursor / Claude Desktop plug straight in.
>
> playground (scripted agent attempts 8 actions live):
> https://mandateseal.vercel.app/playground
>
> docs:
> https://mandateseal.vercel.app/docs

---

## Show HN

Title: **Show HN: MandateSeal — Permission and proof layer for autonomous crypto agents**

Body:

```
Hey HN — I built MandateSeal because every "AI agent with a wallet" project I
saw was one prompt-injection away from a drainer. The pattern always devolves
into "trust the LLM not to do bad things."

MandateSeal is a gateway that sits between the agent and the chain. Before any
onchain action, the agent presents it to MandateSeal; the mandate engine
returns APPROVED / BLOCKED / NEEDS_APPROVAL with a signed receipt. Receipts
get merkle-batched and broadcast to Base, so anyone can verify what the
agent was allowed to do without trusting MandateSeal itself.

Stack: Next.js 14 + Postgres + Ed25519 + viem. ~150 unit tests, fully
open source.

What's there:
- Wallet mandates (chains, tokens, contracts, recipients, tx caps,
  approval gates, infinite-approval blocked outright)
- Onchain anchors on Base Sepolia (live; first 4 batches anchored)
- MCP server adapter — point Claude Desktop / Claude Code / Cursor at
  /api/mcp and every tool call gets sealed
- Public receipt explorer with dynamic OG images
- Agent reputation scoring (volume + anchored ratio + approval² +
  block penalty + longevity + recency)
- Idempotency / replay protection on every mutating endpoint
- Rate limiting, per-tool quotas, SIWE wallet auth

What's NOT there:
- Token / coin (deliberately deferred — PMF first)
- Multi-tenant workspaces (v1.0)
- MandateSeal-signed tx broadcasting (caller still signs and broadcasts)
- Solidity verifier contract

Live: https://mandateseal.vercel.app
Playground (zero setup): https://mandateseal.vercel.app/playground
Repo: https://github.com/mandateseal/mandateseal

Happy to answer questions on the policy engine, the receipt format,
the MCP integration, or why I think token-launch-first is the wrong
order for trust infra.
```

---

## MCP server registry entry

For PR against [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers):

```yaml
- name: MandateSeal
  description: |
    Permission and proof layer for autonomous crypto agents.
    Every tools/call is gated by a wallet mandate and produces two
    Ed25519-signed receipts (preflight + outcome), merkle-anchored to Base.
  url: https://mandateseal.vercel.app/api/mcp
  transport: streamable-http
  auth: bearer
  source: https://github.com/mandateseal/mandateseal
  category: security
  language: TypeScript
```

Sample `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mandateseal": {
      "transport": "http",
      "url": "https://mandateseal.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer msk_..."
      }
    }
  }
}
```

---

## Launch checklist

Day-of:

- [ ] Hit publish on the X thread (above)
- [ ] Mirror to Farcaster (the single cast variant)
- [ ] Submit Show HN — use the title verbatim, body slightly tightened if needed
- [ ] Open PR against modelcontextprotocol/servers with the registry entry
- [ ] Post a short cast in the right places: ai16z dev channel, Virtuals discord,
      Bittensor subnet operators forum, /r/LocalLLaMA (link the playground)
- [ ] Watch /receipts on the live deploy — first wave of curious clicks should
      generate real preflight rows you can screenshot for follow-up posts

Day-after:

- [ ] If the thread gets traction, drop a follow-up tweet with a specific
      receipt URL — e.g. "here's the OG image rendering on Twitter for a
      blocked drainer attempt: https://mandateseal.vercel.app/r/rct_..."
- [ ] Reply to every serious question with a link to the matching /docs
      section rather than retyping
- [ ] If the MCP showcase PR is accepted, retweet the merge

Pre-flight verification (do these before pressing publish on anything):

- [ ] `curl https://mandateseal.vercel.app/api/key.pub` returns the Ed25519 PEM
- [ ] `curl https://mandateseal.vercel.app/api/mcp` returns the health JSON
- [ ] /playground loads + the "PLAY" sequence completes without errors
- [ ] /r/[any-existing-receipt-id] renders with the OG image preview alive
- [ ] /a/agent_atlas_01 shows a non-NEW reputation tier
- [ ] Latest anchor batch's BaseScan link still resolves
- [ ] Demo API key still works against /api/check
