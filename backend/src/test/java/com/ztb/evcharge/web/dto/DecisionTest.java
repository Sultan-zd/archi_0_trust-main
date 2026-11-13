package com.ztb.evcharge.web.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DecisionTest {

    /** Reponse type de POST /access (voir api/pdp.py : decide()). */
    @Test
    void convertitLaReponseFastApi() {
        Map<String, Object> raw = Map.of(
                "request_id", "abc-123",
                "decision", "MFA",
                "reason", "DEVICE_UNKNOWN_MFA",
                "policy_decision", "MFA",
                "risk", Map.of(
                        "final", 35, "ai", 10, "context", 25,
                        "context_reasons", List.of("zone inhabituelle (Paris au lieu de Lyon) +25"),
                        "components", Map.of("random_forest", 0.01),
                        "predicted_class", "Benign"),
                "identity", Map.of("role", "User", "active", true, "trusted_device", false),
                "evidence_hash", "0xdeadbeef");

        Decision d = Decision.from(raw);

        assertThat(d.decision()).isEqualTo("MFA");
        assertThat(d.reason()).isEqualTo("DEVICE_UNKNOWN_MFA");
        assertThat(d.finalRisk()).isEqualTo(35);
        assertThat(d.aiRisk()).isEqualTo(10);
        assertThat(d.contextRisk()).isEqualTo(25);
        assertThat(d.contextReasons()).containsExactly("zone inhabituelle (Paris au lieu de Lyon) +25");
        assertThat(d.trustedDevice()).isFalse();
        assertThat(d.role()).isEqualTo("User");
        assertThat(d.mfaPassed()).isNull();
        assertThat(d.requestId()).isEqualTo("abc-123");
        assertThat(d.fastApiSessionId()).isNull();
    }

    @Test
    void toleraUneReponseIncomplete() {
        Decision d = Decision.from(Map.of("decision", "DENY"));

        assertThat(d.decision()).isEqualTo("DENY");
        assertThat(d.finalRisk()).isZero();
        assertThat(d.contextReasons()).isEmpty();
    }
}
