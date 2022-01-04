// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

abstract contract BlockTimeOverridable {
    uint256 private _blockTimeOverride;

    constructor() {
        _blockTimeOverride = block.timestamp;
    }

    // Override block time in hardhat testing environment
    function blockTime() public view returns (uint256) {
        if (block.chainid == 31337) {
            return _blockTimeOverride;
        }

        return block.timestamp;
    }

    function setblockTime(uint256 _t) external {
        _blockTimeOverride = _t;
    }
}
