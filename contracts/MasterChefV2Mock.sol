// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

contract MasterChefV2Mock {
    mapping(address => uint256) info;

    function setLP(address _a, uint256 _lp) external {
        info[_a] = _lp;
    }

    function userInfo(uint256, address _a) external view returns (uint256, uint256) {
        return (info[_a], 0);
    }
}
