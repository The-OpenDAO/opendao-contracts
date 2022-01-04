// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyERC20 is ERC20 {
    constructor(string memory _name) ERC20(_name, _name) { }

    function mint(uint256 _amount) external {
        _mint(msg.sender, _amount);
    }

    function mintTo(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}
