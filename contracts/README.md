# MandateSeal contracts

## FeeVault.sol — fee-gate prepaid-credit vault

Holds the MandateSeal token ($SEAL) for the fee-gate (roadmap W9). Users deposit
→ vault records lifetime-deposited per owner + emits `Deposited` → MandateSeal's
off-chain indexer grants prepaid credits → metered per paid action. No per-action
on-chain write; treasury-only withdrawal. See [`../docs/feevault-design.md`](../docs/feevault-design.md).

> **Status: compiled + unit-tested** (Foundry, 8/8 — see [`../test/FeeVault.t.sol`](../test/FeeVault.t.sol)).
> NOT yet testnet-deployed or audited. **Do not deploy to mainnet** until reviewed +
> validated on Base Sepolia — it holds real funds.

### Token

$SEAL (Base mainnet): `0x0590908e797a077699DEb7905De955A4425F9BA3`
(wire as the constructor `token_` at deploy; use a testnet mock ERC-20 on Base Sepolia first).

### Dependencies

- `@openzeppelin/contracts` (^5) — SafeERC20, Ownable, Pausable, ReentrancyGuard.

### Build / test (Foundry — set up in `foundry.toml`)

OZ is vendored via npm (`@openzeppelin/contracts@^5`), remapped in `foundry.toml`
— no git submodule.
```bash
forge build       # compiles contracts/ (solc 0.8.24)
forge test        # test/FeeVault.t.sol — 8/8 passing
```

### Next steps (deliberate, in order)

1. ~~Pick toolchain + compile + test~~ ✅ done (Foundry, 8/8).
2. Deploy to **Base Sepolia** with a mock $SEAL → wire the deposit indexer →
   e2e: deposit → indexer grants credits → fee-gate meters. (needs a testnet
   deployer wallet with gas)
3. Review (ideally external) before any mainnet deploy.
4. Mainnet: deploy with real $SEAL CA, set treasury (multisig), flip
   `FEE_GATE_ENABLED=true` (P3) — the launch of the actual token utility.
