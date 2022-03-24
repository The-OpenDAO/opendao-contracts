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

    event BuyWL(address indexed buyer, uint count, uint projectID);

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
        uint256 startBlock;
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

    function setTotalSupply(uint256 projectID, uint16 totalSupply) external onlyOwner {
        projects[projectID].totalSupply = totalSupply;
    }

    function setMaxPerWallet(uint256 projectID, uint8 maxPerWallet) external onlyOwner {
        projects[projectID].maxPerWallet = maxPerWallet;
    }

    function setPrice(uint256 projectID, uint40 price) external onlyOwner {
        projects[projectID].price = price;
    }

    function toggleAllowContract(uint256 projectID) external onlyOwner {
        projects[projectID].allowContract = !projects[projectID].allowContract;
    }

    function toggleEnable(uint256 projectID) external onlyOwner {
        projects[projectID].isSaleEnabled = !projects[projectID].isSaleEnabled;
    }

    function toggleUseWLAddressList(uint256 projectID) external onlyOwner {
        projects[projectID].useWLAddressList = !projects[projectID].useWLAddressList;
    }

    function getByPage(uint256 projectID, uint256 page, uint256 size) external view returns(address[] memory a) {
        address[] memory wlList;
        uint start = page * size;
        uint end = page * size + size;
        if(end > projects[projectID].wlListLen) {
            end = projects[projectID].wlListLen;
        }
        for(uint i=start; i<end; i++) {
            wlList[i] = projects[projectID].WLAddressList[i];
        }
        return wlList;
    }

    function buyWL(uint256 projectID, uint16 count) external {
        Project storage p = projects[projectID];

        require(p.isSaleEnabled, "SaleNotEnabled");
        if(!p.allowContract && tx.origin != msg.sender) {
            revert NotAllowContract(tx.origin, msg.sender);
        }

        uint256 price = uint256(p.price) * 1 ether;
        uint256 amount = price * uint256(count);

        sosToken.safeTransferFrom(msg.sender, address(1), amount * 90 / 100);
        sosToken.safeTransferFrom(msg.sender, treasury, amount);

        if(p.useWLAddressList) {
            p.WLAddressList.push(msg.sender);
            p.wlListLen++;
        }

        if(p.maxPerWallet!=0) {
            require(p.ownedWL[msg.sender] + count <= p.maxPerWallet, "ExeceedMaxPerWallet");
        }
        if(p.totalBought + count > p.totalSupply) {
            revert ExeceedMaxSupply(p.totalSupply, p.totalBought);
        }

        p.ownedWL[msg.sender] += count;
        p.totalBought += count;

        emit BuyWL(msg.sender, count, projectID);
    }

}


