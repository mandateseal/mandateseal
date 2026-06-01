// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FeeVault — prepaid-credit vault for MandateSeal's fee-gate.
/// @notice Holds the MandateSeal token ($SEAL). Users deposit; the vault records
///         lifetime-deposited per owner and emits `Deposited`. MandateSeal's
///         off-chain indexer turns deposits into prepaid credits, then meters
///         them per paid action. NO per-action on-chain write — the hot path
///         stays off-chain. The vault never spends user funds; only the treasury
///         (owner) can withdraw accumulated balance.
/// @dev DRAFT — not yet compiled/tested/audited. Do not deploy to mainnet until
///      it is. $SEAL on Base: 0x0590908e797a077699DEb7905De955A4425F9BA3.
contract FeeVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The ERC-20 accepted for deposits ($SEAL).
    IERC20 public immutable token;

    /// @notice Lifetime amount deposited and credited to each owner (token base units).
    ///         Monotonic — the indexer reconciles credits against this.
    mapping(address => uint256) public depositedOf;

    event Deposited(address indexed owner, address indexed from, uint256 amount, uint256 lifetime);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error ZeroAddress();

    constructor(address token_, address treasury_) Ownable(treasury_) {
        if (token_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        token = IERC20(token_);
    }

    /// @notice Deposit `amount` of the token, credited to `owner`. `owner` may
    ///         differ from msg.sender so a funder can top up an agent's owner.
    /// @dev Pulls tokens via transferFrom — caller must approve the vault first.
    function deposit(address owner, uint256 amount) external nonReentrant whenNotPaused {
        if (owner == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 lifetime = depositedOf[owner] + amount;
        depositedOf[owner] = lifetime;
        emit Deposited(owner, msg.sender, amount, lifetime);
    }

    /// @notice Treasury withdraws accumulated fees. Vault holds no per-user claim,
    ///         so this is a pooled-treasury model (credits live off-chain).
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        token.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
