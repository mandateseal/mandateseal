// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TESTNET-ONLY mock of $SEAL — open mint, for FeeVault e2e on Base
///         Sepolia. Do NOT deploy to mainnet. Real $SEAL (Base mainnet):
///         0x0590908e797a077699DEb7905De955A4425F9BA3.
contract MockSEAL is ERC20 {
    constructor() ERC20("Mock SEAL", "mSEAL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
