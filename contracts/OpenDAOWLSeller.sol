//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OpenDAOWLSeller is Ownable {
    using SafeERC20 for IERC20;

    error SOSIncorrect(uint256 expect, uint256 actual);
    error NotAllowContract(address txOrigin, address sender);
    error ExeceedMaxPerWallet(uint256 max, uint256 owned);
    error ExeceedMaxSupply(uint256 supply, uint256 bought);
    error SaleNotEnabled();

    IERC20 public immutable sosToken;
    address public immutable treasury;
    uint256 nextProjectID = 0;

    struct Project {
        uint16 totalSupply;
        uint16 totalBought;
        uint16 wlListLen;
        uint8 maxPerWallet;
        bool allowContract;
        bool useWLAddressList;
        uint40 price;
        address[] WLAddressList;
        mapping (address => uint256) ownedWL;
        uint32 startBlock;
        bool isSaleEnabled;
    }

    mapping(uint256 => Project) public projects;

    constructor(IERC20 _sosToken, address _treasury) {
        sosToken = _sosToken;
        treasury = _treasury;
    }

    function addProject(uint16 totalSupply, uint40 price) external onlyOwner {
        projects[nextProjectID].totalSupply = totalSupply;
        projects[nextProjectID].totalBought = 0;
        projects[nextProjectID].wlListLen = 0;
        projects[nextProjectID].maxPerWallet = 1;
        projects[nextProjectID].allowContract = false;
        projects[nextProjectID].useWLAddressList = true;
        projects[nextProjectID].price = price;
        projects[nextProjectID].startBlock = block.number;
        projects[nextProjectID].isSaleEnabled = false;
        ++nextProjectID;
    }

    function setTotalSupply(uint256 projecdtID, uint256 totalSupply) external onlyOwner {
        projects[projecdtID].totalSupply = totalSupply;
    }

    function setMaxPerWallet(uint256 projecdtID, uint256 maxPerWallet) external onlyOwner {
        projects[projecdtID].maxPerWallet = maxPerWallet;
    }

    function setPrice(uint256 projecdtID, uint256 price) external onlyOwner {
        projects[projecdtID].price = price;
    }

    function toggleAllowContract(uint256 projecdtID) external onlyOwner {
        projects[projecdtID].allowContract = !projects[projecdtID].allowContract;
    }

    function toggleEnable(uint256 projecdtID) external onlyOwner {
        projects[projecdtID].isSaleEnabled = !projects[projecdtID].isSaleEnabled;
    }

    function toggleUseWLAddressList(uint256 projecdtID) external onlyOwner {
        projects[projecdtID].useWLAddressList = !projects[projecdtID].useWLAddressList;
    }

    function getByPage(uint256 projecdtID, uint256 page, uint256 size) external view returns(address[] memory a) {
        address[] memory wlList;
        uint start = page * size;
        uint end = page * size + size;
        if(end > projects[projecdtID].wlListLen) {
            end = projects[projecdtID].wlListLen;
        }
        for(uint i=start; i<end; i++) {
            wlList[i] = projects[projecdtID].WLAddressList[i];
        }
        return wlList;
    }

    function buyWL(uint256 projecdtID, uint16 count) external {
        Project memory p = projects[projecdtID];

        require(isSaleEnabled, SaleNotEnabled());
        if(!p.allowContract && tx.origin != msg.sender) {
            revert NotAllowContract(tx.origin, msg.sender);
        }

        uint256 price = p.price * 1 ether;
        uint256 amount = price * count;
        sosToken.safeTransferFrom(msg.sender, address(0), amount * 90 / 100);
        sosToken.safeTransferFrom(msg.sender, treasury, amount - amount * 90 / 100);

        if(p.useWLAddressList) {
            p.WLAddressList.push(msg.sender);
            p.wlListLen++;
        }

        if(p.maxPerWallet!=0) {
            require(p.ownedWL[msg.sender] + count <= p.maxPerWallet, ExeceedMaxPerWallet(p.maxPerWallet, p.ownedWL[msg.sender]));
        }
        require(p.totalBought + count <= p.totalSupply, ExeceedMaxSupply(p.totalSupply, p.totalBought));

        p.ownedWL[msg.sender] += count;
        p.totalBought += count;

        emit BuyWL(msg.sender, count, projectID);
    }

}


