# MandateSeal contracts

## FeeVault.sol — fee-gate prepaid-credit vault

Holds the MandateSeal token ($SEAL) for the fee-gate (roadmap W9). Users deposit
→ vault records lifetime-deposited per owner + emits `Deposited` → MandateSeal's
off-chain indexer grants prepaid credits → metered per paid action. No per-action
on-chain write; treasury-only withdrawal. See [`../docs/feevault-design.md`](../docs/feevault-design.md).

> **Status: DRAFT.** Authored, NOT yet compiled / tested / audited. **Do not deploy
> to mainnet** until it is. It holds real funds — testnet + tests + review first.

### Token

$SEAL (Base mainnet): `0x0590908e797a077699DEb7905De955A4425F9BA3`
(wire as the constructor `token_` at deploy; use a testnet mock ERC-20 on Base Sepolia first).

### Dependencies

- `@openzeppelin/contracts` (^5) — SafeERC20, Ownable, Pausable, ReentrancyGuard.

### Build / test (toolchain TBD — see "Next steps")

Foundry (recommended):
```bash
forge install OpenZeppelin/openzeppelin-contracts
forge build
forge test
```
Hardhat 3 (alt — integrates with the repo's viem):
```bash
npm i -D hardhat @openzeppelin/contracts
npx hardhat compile && npx hardhat test
```

### Next steps (deliberate, in order)

1. Pick toolchain (Foundry vs Hardhat-3) → set up + `forge build`/`compile`.
2. Tests: deposit credits an owner; deposit zero/zero-addr reverts; only-owner
   withdraw; pause blocks deposit; reentrancy safe; `Deposited` event shape.
3. Deploy to **Base Sepolia** with a mock $SEAL → wire the deposit indexer →
   e2e: deposit → indexer grants credits → fee-gate meters.
4. Review (ideally external) before any mainnet deploy.
5. Mainnet: deploy with real $SEAL CA, set treasury (multisig), flip
   `FEE_GATE_ENABLED=true` (P3) — the launch of the actual token utility.
