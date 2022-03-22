//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract OpenDAOWLSeller is Ownable {
    using SafeERC20 for IERC20;

    error SOSIncorrect(uint256 expect, uint256 actual);

    IERC20 public immutable sosToken;
    address public immutable treasury;

    uint256 nextProjectID = 0;

    struct Project {
        uint16 totalSupply;
        uint8 maxPerWallet;
        bool allowContract;
        bool xbbb;
        uint40 price;
        address[] xxx;
        uint32 startBlock;
        uint32 endTime;
    }

    // projectId
    mapping(uint256 => Project) public projects;

    constructor(IERC20 _sosToken) {
        sosToken = _sosToken;
    }

    function addProject(uint256 wlAmount) external onlyOwner {
        projects[nextProjectID] = wlAmount;
        projects[nextProjectID].startBlock = block.number;

        ++nextProjectID;
    }

    function setProject(uint256 projecdtID, uint256 newAmount) external onlyOwner {
        projects[projecdtID] = newAmount;
    }

    function endSale(uint256 projecdtID, uint256 newAmount) external onlyOwner {
        projects[projecdtID].endTime = newAmount;
    }

    function getByPage(uint256 page, uint256 size) external view returns(address[] memory a) {
        projects[projecdtID].xxx[pa]
    }

    function buyWL(uint256 projecdtID, uint16 count) external {
        Project memory p = projects[projecdtID];

        if(!p.allowContract && tx.origin != msg.sender) {
            revert NotAllowContract(tx.origin, msg.sender);
        }


        uint256 price = p.price * 1 ether;
        uint256 amount = price * count;
        sosToken.safeTransferFrom(msg.sender, address(0), amount * 90 / 100);
        sosToken.safeTransferFrom(msg.sender, treasury, amount - amount * 90 / 100);
        projects[projecdtID].totalSupply -= count;

        if(p.xbbb)
             projects[projecdtID].xxx.push(msg.sender);

        if(p.maxPerWallet!=0) {
            
        }

        emit BuyWL(msg.sender, count, projectID);
    }

}


