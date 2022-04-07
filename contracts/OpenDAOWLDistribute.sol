//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OpenDAOWLDistribute is Ownable {
    using SafeERC20 for IERC20;

    event RequestWL(address requester, uint projectID, uint256 burned, uint256 treasury);
    event ProjectAdded(uint256 projectID, string name);

    IERC20 public immutable sosToken;
    address public immutable treasury;
    uint256 public nextProjectID = 1;

    struct Project {
        uint40 price;
        uint16 totalSupply;
        uint16 totalBought;
        uint32 startBlock;
        uint48 startTime;
        bool isEnabled;
        uint48 endTime;
    }

    mapping(uint256 => Project) public projects; //map from project id to project object
    mapping(uint256 => mapping (address => uint256)) public ownedWLs; //how many whitelist each address bought

    constructor(IERC20 _sosToken, address _treasury) {
        sosToken = _sosToken;
        treasury = _treasury;
    }

    function addProject(string calldata projectName, Project memory _project) external onlyOwner {
        require(_project.totalSupply > 0, "InvalidTotalSupply");
        require(_project.endTime >= block.timestamp, "InvalidEndtime");
        
        _project.totalBought = 0;
        _project.startBlock = uint32(block.number);
        projects[nextProjectID] = _project;

        emit ProjectAdded(nextProjectID, projectName);
        ++nextProjectID;
    }

    function setProject(Project calldata _project, uint256 projectID) external onlyOwner {
        require(projects[projectID].totalSupply > 0, "InvalidProject");
        require(_project.totalSupply > 0, "InvalidTotalSupply");
        require(_project.endTime >= block.timestamp, "InvalidEndtime");

        Project storage p = projects[projectID];
        p.totalSupply = _project.totalSupply;
        p.price = _project.price;
        p.endTime = _project.endTime;
        p.isEnabled = _project.isEnabled;
    }

    function toggleEnable(uint256 projectID) external onlyOwner {
        require(projects[projectID].totalSupply > 0, "InvalidProject");
        projects[projectID].isEnabled = !projects[projectID].isEnabled;
    }

    function requestWL(uint256 projectID) external {
        require(projects[projectID].totalSupply > 0, "InvalidProject");
        Project memory p = projects[projectID];

        require(p.isEnabled, "NotEnabled");
        require(tx.origin == msg.sender, "NotAllowContract");
        require(p.endTime >= block.timestamp, "ProjectHasEnded");
        require(p.startTime <= block.timestamp, "ProjectNotStarted");
        require(ownedWLs[projectID][msg.sender] == 0, "AlreadyWhitelisted");

        uint256 price = uint256(p.price) * 1 ether;

        uint256 burned = price * 90 / 100;
        sosToken.safeTransferFrom(msg.sender, address(1), burned);
        sosToken.safeTransferFrom(msg.sender, treasury, price - burned);

        require(p.totalBought + 1 <= p.totalSupply, "ExeceedMaxSupply");

        ownedWLs[projectID][msg.sender] = 1;
        p.totalBought += 1;

        projects[projectID] = p;
        emit RequestWL(msg.sender, projectID, burned, price - burned);
    }
}


