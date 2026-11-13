package com.ztb.evcharge.web.dto;

import com.ztb.evcharge.domain.ChargeSession;
import java.time.Instant;

public record ChargeSessionDto(
        Long id,
        String username,
        Long stationId,
        String stationName,
        String city,
        String status,
        String decision,
        String reason,
        Integer aiRisk,
        Integer finalRisk,
        String requestId,
        String evidenceHash,
        Instant startedAt,
        Instant endedAt) {

    public static ChargeSessionDto from(ChargeSession s) {
        return new ChargeSessionDto(
                s.getId(),
                s.getUsername(),
                s.getStation().getId(),
                s.getStation().getName(),
                s.getStation().getCity(),
                s.getStatus().name(),
                s.getDecision(),
                s.getReason(),
                s.getAiRisk(),
                s.getFinalRisk(),
                s.getRequestId(),
                s.getEvidenceHash(),
                s.getStartedAt(),
                s.getEndedAt());
    }
}
