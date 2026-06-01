// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FeeVault} from "../contracts/FeeVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

// Minimal cheatcode interface (avoids a forge-std submodule for this small suite).
interface Vm {
    function prank(address) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
}

contract MockSEAL is ERC20 {
    constructor() ERC20("Mock SEAL", "mSEAL") {}
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}

contract FeeVaultTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    MockSEAL token;
    FeeVault vault;
    address treasury = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        token = new MockSEAL();
        vault = new FeeVault(address(token), treasury);
        token.mint(address(this), 1_000e18);
        token.approve(address(vault), type(uint256).max);
    }

    function testDepositCreditsOwner() public {
        vault.deposit(alice, 100e18);
        require(vault.depositedOf(alice) == 100e18, "depositedOf mismatch");
        require(token.balanceOf(address(vault)) == 100e18, "vault balance mismatch");
    }

    function testDepositAccumulates() public {
        vault.deposit(alice, 40e18);
        vault.deposit(alice, 60e18);
        require(vault.depositedOf(alice) == 100e18, "did not accumulate");
    }

    function testDepositOnBehalfOfAnotherOwner() public {
        vault.deposit(bob, 25e18); // funder = this, credited owner = bob
        require(vault.depositedOf(bob) == 25e18, "on-behalf deposit failed");
        require(vault.depositedOf(address(this)) == 0, "credited the funder by mistake");
    }

    function testDepositZeroAmountReverts() public {
        vm.expectRevert(FeeVault.ZeroAmount.selector);
        vault.deposit(alice, 0);
    }

    function testDepositZeroOwnerReverts() public {
        vm.expectRevert(FeeVault.ZeroAddress.selector);
        vault.deposit(address(0), 10e18);
    }

    function testNonOwnerCannotWithdraw() public {
        vault.deposit(alice, 100e18);
        // caller = this (not treasury); OZ error carries the offending address.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        vault.withdraw(address(this), 10e18);
    }

    function testTreasuryCanWithdraw() public {
        vault.deposit(alice, 100e18);
        vm.prank(treasury);
        vault.withdraw(treasury, 30e18);
        require(token.balanceOf(treasury) == 30e18, "treasury did not receive funds");
    }

    function testPauseBlocksDeposit() public {
        vm.prank(treasury);
        vault.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.deposit(alice, 10e18);
    }
}
