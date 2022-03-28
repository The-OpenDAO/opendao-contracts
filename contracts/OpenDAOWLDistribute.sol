//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OpenDAOWLDistribute is Ownable {
    using SafeERC20 for IERC20;

    event RequestWL(address indexed requester, uint count, uint projectID);

    IERC20 public immutable sosToken;
    address public immutable treasury;
    uint256 nextProjectID = 1;

    struct Project {
        uint16 totalSupply;
        uint16 totalBought;
        uint8 maxPerWallet;
        bool allowContract;
        uint40 price;
        uint32 startBlock;
        bool isEnabled;
    }

    mapping(uint256 => Project) public projects; //map from project id to project object
    mapping(uint256 => string) public projectNames; //lookup project name by project id
    mapping(uint256 => mapping (address => uint8)) public ownedWLs; //how many whitelist each address bought
    mapping(string => uint256) public projectIds; //lookup project id by project name

    constructor(IERC20 _sosToken, address _treasury) {
        sosToken = _sosToken;
        treasury = _treasury;
    }

    function addProject(uint16 totalSupply, uint40 price, uint8 maxPerWallet, string memory projectName) external onlyOwner {
        require(projectIds[projectName] == 0, "DuplicateProjectName");

        projects[nextProjectID].totalSupply = totalSupply;
        projects[nextProjectID].totalBought = 0;
        projects[nextProjectID].maxPerWallet = maxPerWallet;
        projects[nextProjectID].allowContract = false;
        projects[nextProjectID].price = price;
        projects[nextProjectID].startBlock = uint32(block.number);
        projects[nextProjectID].isEnabled = false;
        projectNames[nextProjectID] = projectName;
        projectIds[projectName] = nextProjectID;
        ++nextProjectID;
    }

    function toggleAllowContract(uint256 projectID) external onlyOwner {
        require(projects[projectID].totalSupply > 0, "InvalidProject");
        projects[projectID].allowContract = !projects[projectID].allowContract;
    }

    function toggleEnable(uint256 projectID) external onlyOwner {
        require(projects[projectID].totalSupply > 0, "InvalidProject");
        projects[projectID].isEnabled = !projects[projectID].isEnabled;
    }

    function getProjectID(string memory projectName) external view returns(uint256 pid) {
        return projectIds[projectName];
    }

    function requestWL(uint256 projectID, uint8 count) external {
        require(projects[projectID].totalSupply > 0, "InvalidProject");
        Project storage p = projects[projectID];

        require(p.isEnabled, "NotEnabled");
        if (!p.allowContract) {
            require(tx.origin == msg.sender, "NotAllowContract");
        }

        uint256 price = uint256(p.price) * 1 ether;
        uint256 amount = price * uint256(count);

        sosToken.safeTransferFrom(msg.sender, address(this), amount * 90 / 100);
        sosToken.safeTransferFrom(msg.sender, treasury, amount - amount * 90 / 100);

        if (p.maxPerWallet!=0) {
            require(ownedWLs[projectID][msg.sender] + count <= p.maxPerWallet, "ExeceedMaxPerWallet");
        }
        require(p.totalBought + count <= p.totalSupply, "ExeceedMaxSupply");

        ownedWLs[projectID][msg.sender] += count;
        p.totalBought += count;

        emit RequestWL(msg.sender, count, projectID);
    }

}


