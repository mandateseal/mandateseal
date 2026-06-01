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

## Testnet deploy (Base Sepolia) — commands

Prereqs: a deployer key funded with Base Sepolia ETH (faucet) + a Sepolia RPC.
Keep both local only (e.g. `.env`, gitignored). `$TREASURY`/`$OWNER` can be your
own address; `forge`/`cast` are on the Foundry PATH (`~/.foundry/bin`).

```bash
RPC=https://sepolia.base.org   # or a dedicated Sepolia RPC
KEY=0x<testnet-deployer-key>   # funded via a Base Sepolia faucet

# 1. mock $SEAL (testnet stand-in)
forge create contracts/mocks/MockSEAL.sol:MockSEAL --broadcast --rpc-url "$RPC" --private-key "$KEY"
#   → MOCK=<deployed address>

# 2. FeeVault(token=mock, treasury=you)
forge create contracts/FeeVault.sol:FeeVault --broadcast --rpc-url "$RPC" --private-key "$KEY" \
  --constructor-args "$MOCK" "$TREASURY"
#   → VAULT=<deployed address>

# 3. e2e: mint → approve → deposit → read depositedOf (expect 100e18)
cast send "$MOCK"  "mint(address,uint256)"    "$OWNER" 1000000000000000000000 --rpc-url "$RPC" --private-key "$KEY"
cast send "$MOCK"  "approve(address,uint256)" "$VAULT" 1000000000000000000000 --rpc-url "$RPC" --private-key "$KEY"
cast send "$VAULT" "deposit(address,uint256)" "$OWNER"  100000000000000000000 --rpc-url "$RPC" --private-key "$KEY"
cast call "$VAULT" "depositedOf(address)"     "$OWNER" --rpc-url "$RPC"   # → 100000000000000000000

# 4. wire MandateSeal: set FEE_GATE_VAULT_ADDRESS=$VAULT, FEE_GATE_RPC_URL=$RPC,
#    then reconcileEntitlement(owner) grants credits (granted = 100 at rate 1).
```
