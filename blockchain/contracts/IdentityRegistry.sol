// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract IdentityRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum Role { None, User, Fleet, Admin }

    struct User {
        Role role;
        bool active;
        uint64 registeredAt;
        uint64 revokedAt;
    }

    struct Device {
        bytes32 owner;
        bool active;
        uint64 registeredAt;
        uint64 revokedAt;
    }

    mapping(bytes32 => User) private _users;
    mapping(bytes32 => Device) private _devices;

    event UserRegistered(bytes32 indexed userId, Role role);
    event UserRevoked(bytes32 indexed userId);
    event DeviceRegistered(bytes32 indexed deviceId, bytes32 indexed owner);
    event DeviceRevoked(bytes32 indexed deviceId);

    error InvalidRole();
    error AlreadyRegistered(bytes32 id);
    error NotRegistered(bytes32 id);
    error AlreadyRevoked(bytes32 id);
    error OwnerNotActive(bytes32 owner);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function registerUser(bytes32 userId, Role role) external onlyRole(REGISTRAR_ROLE) {
        if (role == Role.None) revert InvalidRole();
        if (_users[userId].registeredAt != 0) revert AlreadyRegistered(userId);
        _users[userId] = User({role: role, active: true, registeredAt: uint64(block.timestamp), revokedAt: 0});
        emit UserRegistered(userId, role);
    }

    function revokeUser(bytes32 userId) external onlyRole(REGISTRAR_ROLE) {
        User storage u = _users[userId];
        if (u.registeredAt == 0) revert NotRegistered(userId);
        if (!u.active) revert AlreadyRevoked(userId);
        u.active = false;
        u.revokedAt = uint64(block.timestamp);
        emit UserRevoked(userId);
    }

    function registerDevice(bytes32 deviceId, bytes32 owner) external onlyRole(REGISTRAR_ROLE) {
        if (_devices[deviceId].registeredAt != 0) revert AlreadyRegistered(deviceId);
        if (!_users[owner].active) revert OwnerNotActive(owner);
        _devices[deviceId] = Device({owner: owner, active: true, registeredAt: uint64(block.timestamp), revokedAt: 0});
        emit DeviceRegistered(deviceId, owner);
    }

    function revokeDevice(bytes32 deviceId) external onlyRole(REGISTRAR_ROLE) {
        Device storage d = _devices[deviceId];
        if (d.registeredAt == 0) revert NotRegistered(deviceId);
        if (!d.active) revert AlreadyRevoked(deviceId);
        d.active = false;
        d.revokedAt = uint64(block.timestamp);
        emit DeviceRevoked(deviceId);
    }

    function getUser(bytes32 userId) external view returns (User memory) { return _users[userId]; }
    function getDevice(bytes32 deviceId) external view returns (Device memory) { return _devices[deviceId]; }
    function isUserRegistered(bytes32 userId) public view returns (bool) { return _users[userId].registeredAt != 0; }
    function isUserActive(bytes32 userId) public view returns (bool) { return _users[userId].active; }
    function roleOf(bytes32 userId) external view returns (Role) { return _users[userId].role; }
    function isDeviceTrusted(bytes32 deviceId, bytes32 userId) public view returns (bool) {
        Device storage d = _devices[deviceId];
        return d.active && d.owner == userId && _users[userId].active;
    }
}
