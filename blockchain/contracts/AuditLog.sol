// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract AuditLog is AccessControl {
    bytes32 public constant LOGGER_ROLE = keccak256("LOGGER_ROLE");

    struct Entry {
        bytes32 requestId;
        bytes32 userId;
        bytes32 deviceId;
        bytes32 resourceId;
        bytes32 evidenceHash;
        uint64 timestamp;
        uint8 riskScore;
        uint8 decision;
        uint8 reason;
    }

    Entry[] private _entries;
    mapping(bytes32 => bool) public seenRequest;
    mapping(bytes32 => uint32) public denyCount;

    event DecisionLogged(uint256 indexed index, bytes32 indexed requestId, bytes32 indexed userId, uint8 decision, uint8 reason, uint8 riskScore, bytes32 evidenceHash);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LOGGER_ROLE, admin);
    }

    function logDecision(bytes32 requestId, bytes32 userId, bytes32 deviceId, bytes32 resourceId, uint8 riskScore, uint8 decision, uint8 reason, bytes32 evidenceHash) external onlyRole(LOGGER_ROLE) returns (uint256 index) {
        if (seenRequest[requestId]) revert();
        seenRequest[requestId] = true;
        if (decision == 2) { unchecked { denyCount[userId] += 1; } }
        index = _entries.length;
        _entries.push(Entry(requestId, userId, deviceId, resourceId, evidenceHash, uint64(block.timestamp), riskScore, decision, reason));
        emit DecisionLogged(index, requestId, userId, decision, reason, riskScore, evidenceHash);
    }

    function count() external view returns (uint256) { return _entries.length; }
    function getEntry(uint256 index) external view returns (Entry memory) { return _entries[index]; }
}
