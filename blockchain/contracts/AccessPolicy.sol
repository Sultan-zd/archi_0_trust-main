// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IdentityRegistry} from "./IdentityRegistry.sol";

contract AccessPolicy is AccessControl {
    bytes32 public constant POLICY_ADMIN_ROLE = keccak256("POLICY_ADMIN_ROLE");

    enum Decision { Allow, MFA, Deny }
    enum Reason { Ok, ResourceUnknown, ResourceDisabled, UserUnknown, UserRevoked, RoleToolow, OutsideHours, DeviceUntrusted, RiskMfa, RiskDeny, DeviceUnknownMfa }

    struct Policy {
        IdentityRegistry.Role minRole;
        uint8 mfaThreshold;
        uint8 denyThreshold;
        uint8 startHour;
        uint8 endHour;
        bool requireTrustedDevice;
        bool active;
    }

    IdentityRegistry public immutable registry;
    mapping(bytes32 => Policy) private _policies;

    event PolicySet(bytes32 indexed resourceId, Policy policy);

    constructor(address admin, IdentityRegistry registry_) {
        registry = registry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(POLICY_ADMIN_ROLE, admin);
    }

    function setPolicy(bytes32 resourceId, Policy calldata p) external onlyRole(POLICY_ADMIN_ROLE) {
        if (p.minRole == IdentityRegistry.Role.None) revert();
        if (p.mfaThreshold > p.denyThreshold || p.denyThreshold > 100) revert();
        _policies[resourceId] = p;
        emit PolicySet(resourceId, p);
    }

    function getPolicy(bytes32 resourceId) external view returns (Policy memory) { return _policies[resourceId]; }

    function _inWindow(uint8 h, uint8 start, uint8 end_) private pure returns (bool) {
        if (start == end_) return true;
        if (start < end_) return h >= start && h < end_;
        return h >= start || h < end_;
    }

    function evaluate(bytes32 userId, bytes32 deviceId, bytes32 resourceId, uint8 riskScore, uint8 hourUtc) external view returns (Decision, Reason) {
        Policy memory p = _policies[resourceId];
        if (p.minRole == IdentityRegistry.Role.None) return (Decision.Deny, Reason.ResourceUnknown);
        if (!p.active) return (Decision.Deny, Reason.ResourceDisabled);
        if (!registry.isUserRegistered(userId)) return (Decision.Deny, Reason.UserUnknown);
        if (!registry.isUserActive(userId)) return (Decision.Deny, Reason.UserRevoked);
        if (uint8(registry.roleOf(userId)) < uint8(p.minRole)) return (Decision.Deny, Reason.RoleToolow);
        if (!_inWindow(hourUtc, p.startHour, p.endHour)) return (Decision.Deny, Reason.OutsideHours);
        bool trusted = registry.isDeviceTrusted(deviceId, userId);
        if (!trusted && p.requireTrustedDevice) return (Decision.Deny, Reason.DeviceUntrusted);
        if (riskScore >= p.denyThreshold) return (Decision.Deny, Reason.RiskDeny);
        if (riskScore >= p.mfaThreshold) return (Decision.MFA, Reason.RiskMfa);
        if (!trusted) return (Decision.MFA, Reason.DeviceUnknownMfa);
        return (Decision.Allow, Reason.Ok);
    }
}
