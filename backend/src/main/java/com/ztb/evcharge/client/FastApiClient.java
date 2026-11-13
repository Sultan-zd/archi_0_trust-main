package com.ztb.evcharge.client;

import com.ztb.evcharge.config.AppProperties;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Client de l'API Zero Trust FastAPI (PEP/PDP).
 * - /access : on transmet le JWT de l'utilisateur (FastAPI le valide lui-meme et en tire l'identite) ;
 * - routes /admin/* et /attack/* : protegees par la cle x-api-key, qui ne quitte jamais le backend.
 */
@Component
public class FastApiClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };

    private final RestClient client;
    private final String adminApiKey;

    public FastApiClient(AppProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(30000);
        this.client = RestClient.builder()
                .baseUrl(props.fastapi().baseUrl())
                .requestFactory(factory)
                .build();
        this.adminApiKey = props.fastapi().adminApiKey();
    }

    // ------------------------------------------------------------------ decisions Zero Trust

    /** Requete d'acces avec le jeton de l'utilisateur. sync_audit=true : la transaction AuditLog est confirmee avant la reponse. */
    public Map<String, Object> access(String bearerToken, Map<String, Object> body) {
        return client.post()
                .uri("/access?sync_audit=true")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(MAP);
    }

    // ------------------------------------------------------------------ MFA de l'utilisateur connecte (son JWT)

    public Map<String, Object> mfaStatus(String bearerToken) {
        return client.get().uri("/mfa/status")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
                .retrieve().body(MAP);
    }

    public Map<String, Object> mfaEnroll(String bearerToken, Map<String, Object> body) {
        return client.post().uri("/mfa/enroll")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve().body(MAP);
    }

    public Map<String, Object> mfaConfirm(String bearerToken, Map<String, Object> body) {
        return client.post().uri("/mfa/confirm")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve().body(MAP);
    }

    // ------------------------------------------------------------------ consultation

    public Map<String, Object> health() {
        return client.get().uri("/health").retrieve().body(MAP);
    }

    public Map<String, Object> resources() {
        return client.get().uri("/resources").retrieve().body(MAP);
    }

    public Map<String, Object> identity(String username) {
        return client.get().uri("/identity/{user}", username).retrieve().body(MAP);
    }

    public Map<String, Object> audit(int limit) {
        return client.get().uri("/audit?limit={limit}", limit).retrieve().body(MAP);
    }

    public Map<String, Object> auditDetail(String requestId) {
        return client.get().uri("/audit/{id}", requestId).retrieve().body(MAP);
    }

    public Map<String, Object> attackStatus() {
        return client.get().uri("/attack/status").retrieve().body(MAP);
    }

    // ------------------------------------------------------------------ administration (x-api-key)

    public Map<String, Object> addUser(Map<String, Object> body) {
        return client.post().uri("/admin/users")
                .header("x-api-key", adminApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve().body(MAP);
    }

    /** Desactive la MFA d'un utilisateur (perte du telephone) : il devra la reactiver. Aucun secret n'est renvoye. */
    public Map<String, Object> resetUserMfa(String username) {
        return client.post().uri("/admin/users/{user}/mfa/reset", username)
                .header("x-api-key", adminApiKey)
                .retrieve().body(MAP);
    }

    public Map<String, Object> revokeUser(String username) {
        return client.post().uri("/admin/users/{user}/revoke", username)
                .header("x-api-key", adminApiKey)
                .retrieve().body(MAP);
    }


}
