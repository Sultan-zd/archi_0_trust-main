package com.ztb.evcharge.web.dto;

import com.ztb.evcharge.util.Json;
import java.util.List;
import java.util.Map;

/** Decision Zero Trust renvoyee par FastAPI (/access), mise a plat pour le frontend. */
public record Decision(
        String decision,        // ALLOW, MFA ou DENY
        String reason,          // code de raison du smart contract (ex. RISK_DENY, DEVICE_UNKNOWN_MFA)
        String policyDecision,  // decision du contrat avant verification TOTP
        int finalRisk,
        int aiRisk,
        int contextRisk,
        List<String> contextReasons,
        Map<String, Object> components,
        String predictedClass,
        boolean trustedDevice,
        String role,
        Boolean mfaPassed,
        String requestId,
        String evidenceHash,
        String fastApiSessionId) {

    public static Decision from(Map<String, Object> raw) {
        Map<String, Object> risk = Json.map(raw.get("risk"));
        Map<String, Object> identity = Json.map(raw.get("identity"));
        Map<String, Object> session = Json.map(raw.get("session"));
        List<String> reasons = Json.list(risk.get("context_reasons")).stream().map(String::valueOf).toList();
        Object mfa = raw.get("mfa_passed");
        return new Decision(
                Json.str(raw.get("decision")),
                Json.str(raw.get("reason")),
                Json.str(raw.get("policy_decision")),
                Json.integer(risk.get("final"), 0),
                Json.integer(risk.get("ai"), 0),
                Json.integer(risk.get("context"), 0),
                reasons,
                Json.map(risk.get("components")),
                Json.str(risk.get("predicted_class")),
                Json.bool(identity.get("trusted_device")),
                Json.str(identity.get("role")),
                mfa instanceof Boolean b ? b : null,
                Json.str(raw.get("request_id")),
                Json.str(raw.get("evidence_hash")),
                Json.str(session.get("id")));
    }
}
