package com.ztb.evcharge.service;

import com.ztb.evcharge.client.FastApiClient;
import com.ztb.evcharge.config.AppProperties;
import com.ztb.evcharge.domain.ChargeSession;
import com.ztb.evcharge.domain.ChargeStatus;
import com.ztb.evcharge.domain.Station;
import com.ztb.evcharge.repo.ChargeSessionRepository;
import com.ztb.evcharge.repo.StationRepository;
import com.ztb.evcharge.web.dto.ChargeRequest;
import com.ztb.evcharge.web.dto.ChargeResult;
import com.ztb.evcharge.web.dto.ChargeSessionDto;
import com.ztb.evcharge.web.dto.Decision;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

/**
 * Logique metier des charges : le backend ne decide jamais lui-meme de l'acces, il demande la decision
 * au PDP (FastAPI + IA + smart contracts) avec le jeton de l'utilisateur, puis enregistre le resultat.
 */
@Service
public class ChargeService {

    private final StationRepository stations;
    private final ChargeSessionRepository sessions;
    private final FastApiClient fastApi;
    private final AppProperties props;

    public ChargeService(StationRepository stations, ChargeSessionRepository sessions, FastApiClient fastApi,
                         AppProperties props) {
        this.stations = stations;
        this.sessions = sessions;
        this.fastApi = fastApi;
        this.props = props;
    }

    /** Demande de demarrage de charge (ressource "charge:start"). Rejouee avec le code TOTP apres une decision MFA. */
    public ChargeResult start(Long stationId, String username, String bearerToken, ChargeRequest request) {
        Station station = stations.findById(stationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Borne inconnue"));
        if (sessions.existsByStationIdAndStatus(stationId, ChargeStatus.ACTIVE)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette borne est deja utilisee");
        }

        Map<String, Object> raw = fastApi.access(bearerToken, accessBody("charge:start", station.getCity(), request));
        Decision decision = Decision.from(raw);

        // Un code MFA renvoye apres une decision MFA met a jour la tentative en attente au lieu d'en creer une nouvelle.
        ChargeSession session = sessions
                .findFirstByUsernameAndStationIdAndStatusOrderByStartedAtDesc(username, stationId, ChargeStatus.PENDING_MFA)
                .orElseGet(() -> {
                    ChargeSession s = new ChargeSession();
                    s.setUsername(username);
                    s.setStation(station);
                    s.setStartedAt(Instant.now());
                    return s;
                });
        session.setDecision(decision.decision());
        session.setReason(decision.reason());
        session.setAiRisk(decision.aiRisk());
        session.setFinalRisk(decision.finalRisk());
        session.setRequestId(decision.requestId());
        session.setEvidenceHash(decision.evidenceHash());
        session.setStatus(switch (String.valueOf(decision.decision())) {
            case "ALLOW" -> ChargeStatus.ACTIVE;
            case "MFA" -> ChargeStatus.PENDING_MFA;
            default -> ChargeStatus.DENIED;
        });
        session = sessions.save(session);
        return new ChargeResult(ChargeSessionDto.from(session), decision);
    }

    /**
     * Arret de charge. Par securite, un arret n'est jamais bloque : l'avis du PDP ("charge:stop") est
     * enregistre et renvoye, mais la charge s'arrete meme s'il est negatif ou injoignable.
     */
    public ChargeResult stop(Long sessionId, String username, boolean admin, String bearerToken, ChargeRequest request) {
        ChargeSession session = sessions.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session inconnue"));
        if (!admin && !session.getUsername().equals(username)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cette session ne vous appartient pas");
        }
        if (session.getStatus() != ChargeStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Aucune charge active pour cette session");
        }

        Decision decision = null;
        ChargeRequest requestWithProof = withRequestProof(request);
        try {
            decision = Decision.from(fastApi.access(bearerToken,
                    accessBody("charge:stop", session.getStation().getCity(), requestWithProof)));
        } catch (RestClientException ignored) {
            // PDP indisponible : on arrete quand meme (comportement sur).
        }
        session.setStatus(ChargeStatus.STOPPED);
        session.setEndedAt(Instant.now());
        session = sessions.save(session);
        return new ChargeResult(ChargeSessionDto.from(session), decision);
    }

    /** Controle d'acces generique sur une ressource (charge:*, billing:read, fleet:dashboard, admin:firmware...). */
    public Decision check(String resource, String bearerToken, ChargeRequest request) {
        String location = request == null ? null : request.location();
        return Decision.from(fastApi.access(bearerToken, accessBody(resource, location, request)));
    }

    private Map<String, Object> accessBody(String resource, String location, ChargeRequest request) {
        if (request == null || request.nonce() == null || request.nonce().isBlank() || request.timestamp() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nonce et horodatage requis");
        }
        Map<String, Object> body = new HashMap<>();
        body.put("resource", resource);
        body.put("nonce", request.nonce());
        body.put("timestamp", request.timestamp());
        if (location != null && !location.isBlank()) {
            body.put("location", location);
        }
        body.put("hour", ZonedDateTime.now(ZoneOffset.UTC).getHour());
        body.put("flow_sample", props.fastapi().flowSample());
        body.put("flow_index", props.fastapi().flowIndex());
        if (request.device() != null && !request.device().isBlank()) {
            body.put("device", request.device().trim());
        }
        if (request.otp() != null && !request.otp().isBlank()) {
            body.put("otp", request.otp().trim());
        }
        return body;
    }

    // L'arrêt reste disponible aux anciens clients ; le backend leur fournit une preuve fraîche.
    private static ChargeRequest withRequestProof(ChargeRequest request) {
        if (request != null && request.nonce() != null && !request.nonce().isBlank() && request.timestamp() != null) {
            return request;
        }
        return new ChargeRequest(
                request == null ? null : request.device(),
                request == null ? null : request.otp(),
                request == null ? null : request.location(),
                UUID.randomUUID().toString(),
                System.currentTimeMillis());
    }
}
