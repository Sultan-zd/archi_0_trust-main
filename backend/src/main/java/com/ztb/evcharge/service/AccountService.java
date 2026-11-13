package com.ztb.evcharge.service;

import com.ztb.evcharge.client.FastApiClient;
import com.ztb.evcharge.client.KeycloakAdminClient;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Creation d'un compte complet : compte Keycloak (identifiants + role), puis identite sur la blockchain
 * (IdentityRegistry) avec son appareil par defaut. Si l'enregistrement on-chain echoue, le compte Keycloak est
 * supprime : il n'existe jamais de compte sans identite on-chain. Utilise par l'admin et par l'inscription publique.
 */
@Service
public class AccountService {

    private final KeycloakAdminClient keycloak;
    private final FastApiClient fastApi;

    public AccountService(KeycloakAdminClient keycloak, FastApiClient fastApi) {
        this.keycloak = keycloak;
        this.fastApi = fastApi;
    }

    public Map<String, Object> create(String username, String email, String password, String role, String homeLocation) {
        String keycloakId = keycloak.createUser(username, email, password, role);
        Map<String, Object> chainBody = new HashMap<>();
        chainBody.put("user", username);
        chainBody.put("role", role);
        if (homeLocation != null && !homeLocation.isBlank()) {
            chainBody.put("home_location", homeLocation.trim());
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
        out.put("username", username);
        out.put("role", role);
        out.put("keycloakId", keycloakId);
        out.put("device", chain.get("device"));
        out.put("txHash", chain.get("tx_hash"));
        return out;
    }
}
