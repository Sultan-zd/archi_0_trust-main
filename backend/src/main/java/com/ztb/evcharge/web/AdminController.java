package com.ztb.evcharge.web;

import com.ztb.evcharge.client.FastApiClient;
import com.ztb.evcharge.client.KeycloakAdminClient;
import com.ztb.evcharge.domain.ChargeStatus;
import com.ztb.evcharge.repo.ChargeSessionRepository;
import com.ztb.evcharge.util.Json;
import com.ztb.evcharge.web.dto.ChargeSessionDto;
import com.ztb.evcharge.web.dto.NewUserRequest;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Routes reservees au role Admin (verifie deux fois : SecurityConfig et @PreAuthorize). */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('Admin')")
public class AdminController {

    private final FastApiClient fastApi;
    private final KeycloakAdminClient keycloak;
    private final ChargeSessionRepository sessions;

    public AdminController(FastApiClient fastApi, KeycloakAdminClient keycloak, ChargeSessionRepository sessions) {
        this.fastApi = fastApi;
        this.keycloak = keycloak;
        this.sessions = sessions;
    }

    // ------------------------------------------------------------------ vue d'ensemble

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalSessions", sessions.count());
        out.put("activeSessions", sessions.countByStatus(ChargeStatus.ACTIVE));

        // Les compteurs ALLOW / MFA / DENY viennent du journal blockchain : chaque decision y figure une fois
        // (y compris les tests de micro-segments et les rejeux apres un MFA). Compter les sessions fausserait le total :
        // une session MFA devient ALLOW une fois le code valide, et un test de micro-segment n'en cree aucune.
        Map<String, Long> byDecision = new LinkedHashMap<>();
        try {
            Map<String, Object> audit = fastApi.audit(500);
            for (Object entry : Json.list(audit.get("entries"))) {
                String decision = Json.str(Json.map(entry).get("decision"));
                if (decision != null) {
                    byDecision.merge(decision, 1L, Long::sum);
                }
            }
            out.put("decisionSource", "blockchain");
            out.put("auditTotal", audit.get("total"));
        } catch (RuntimeException e) {
            // Journal indisponible : repli sur les sessions enregistrees en base.
            for (Object[] row : sessions.countByDecision()) {
                byDecision.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
            }
            out.put("decisionSource", "sessions");
        }
        out.put("byDecision", byDecision);
        try {
            out.put("attackActive", Boolean.TRUE.equals(fastApi.attackStatus().get("attack_active")));
            Map<String, Object> health = fastApi.health();
            out.put("fastapi", "UP");
            out.put("chainId", health.get("chain_id"));
            out.put("block", health.get("block"));
        } catch (Exception e) {
            out.put("fastapi", "DOWN");
        }
        return out;
    }

    @GetMapping("/sessions")
    public List<ChargeSessionDto> allSessions() {
        return sessions.findTop100ByOrderByStartedAtDesc().stream().map(ChargeSessionDto::from).toList();
    }

    // ------------------------------------------------------------------ journal blockchain

    @GetMapping("/audit")
    public Map<String, Object> audit(@RequestParam(defaultValue = "50") int limit) {
        return fastApi.audit(Math.max(1, Math.min(limit, 500)));
    }

    /** Controle d'integrite : empreinte SHA-256 du journal hors chaine comparee a celle ancree dans AuditLog. */
    @GetMapping("/audit/{requestId}")
    public Map<String, Object> auditDetail(@PathVariable String requestId) {
        return fastApi.auditDetail(requestId);
    }

    // ------------------------------------------------------------------ utilisateurs (Keycloak + blockchain)

    @GetMapping("/users")
    public List<Map<String, Object>> users() {
        return keycloak.listUsers();
    }

    /**
     * Cree le compte dans Keycloak, puis l'enregistre sur la blockchain (IdentityRegistry) avec son appareil
     * par defaut. Aucun secret TOTP n'est cree ni montre a l'admin : l'utilisateur active lui-meme sa MFA.
     * Si l'enregistrement on-chain echoue, le compte Keycloak est supprime.
     */
    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createUser(@Valid @RequestBody NewUserRequest req) {
        String keycloakId = keycloak.createUser(req.username(), req.email(), req.password(), req.role());
        Map<String, Object> chainBody = new HashMap<>();
        chainBody.put("user", req.username());
        chainBody.put("role", req.role());
        if (req.homeLocation() != null && !req.homeLocation().isBlank()) {
            chainBody.put("home_location", req.homeLocation().trim());
        }
        Map<String, Object> chain;
        try {
            chain = fastApi.addUser(chainBody);
        } catch (RuntimeException e) {
            try {
                keycloak.deleteUser(keycloakId); // compensation : pas de compte sans identite on-chain
            } catch (RuntimeException ignored) {
                // la cause d'origine est plus utile que l'echec du nettoyage
            }
            throw e;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("username", req.username());
        out.put("role", req.role());
        out.put("keycloakId", keycloakId);
        out.put("device", chain.get("device"));
        out.put("txHash", chain.get("tx_hash"));
        return out;
    }

    /**
     * Revocation : d'abord sur la blockchain (coupe aussi les sessions Zero Trust ouvertes), puis desactivation
     * du compte Keycloak. Dans cet ordre, meme si Keycloak echoue, l'acces est deja refuse par les smart contracts.
     */
    @PostMapping("/users/{username}/revoke")
    public Map<String, Object> revoke(@PathVariable String username, @AuthenticationPrincipal Jwt jwt) {
        if (username.equals(jwt.getClaimAsString("preferred_username"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas revoquer votre propre compte");
        }
        Map<String, Object> chain = fastApi.revokeUser(username);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("username", username);
        out.put("txHash", chain.get("tx_hash"));
        out.put("keycloakDisabled", keycloak.disableUser(username));
        return out;
    }

    /** Perte du telephone : desactive la MFA de l'utilisateur, qui devra scanner un nouveau QR code. */
    @PostMapping("/users/{username}/mfa/reset")
    public Map<String, Object> resetMfa(@PathVariable String username) {
        return fastApi.resetUserMfa(username);
    }

    // ------------------------------------------------------------------ simulation d'attaque

    @GetMapping("/attack")
    public Map<String, Object> attackStatus() {
        return fastApi.attackStatus();
    }

}
