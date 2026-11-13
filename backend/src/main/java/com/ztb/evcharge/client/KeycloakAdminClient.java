package com.ztb.evcharge.client;

import com.ztb.evcharge.config.AppProperties;
import com.ztb.evcharge.util.Json;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * Client minimal de l'API d'administration de Keycloak (creation, liste et desactivation d'utilisateurs).
 * S'authentifie avec le compte admin du realm "master" (admin-cli). Reserve a un usage de demonstration :
 * en production, on utiliserait un client a "service account" avec des droits limites (realm-management).
 */
@Component
public class KeycloakAdminClient {

    private static final Set<String> APP_ROLES = Set.of("User", "Fleet", "Admin");
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() {
    };

    private final RestClient client;
    private final AppProperties.Keycloak config;

    public KeycloakAdminClient(AppProperties props) {
        this.config = props.keycloak();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(15000);
        this.client = RestClient.builder().baseUrl(config.baseUrl()).requestFactory(factory).build();
    }

    private String adminToken() {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", "admin-cli");
        form.add("username", config.adminUsername());
        form.add("password", config.adminPassword());
        form.add("grant_type", "password");
        Map<String, Object> res = client.post()
                .uri("/realms/master/protocol/openid-connect/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(MAP);
        return Json.str(Json.map(res).get("access_token"));
    }

    /** Utilisateurs du realm avec leur role applicatif (User / Fleet / Admin). */
    public List<Map<String, Object>> listUsers() {
        String token = adminToken();
        List<Map<String, Object>> users = client.get()
                .uri("/admin/realms/{realm}/users?max=200", config.realm())
                .headers(h -> h.setBearerAuth(token))
                .retrieve()
                .body(LIST);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> u : users == null ? List.<Map<String, Object>>of() : users) {
            String id = Json.str(u.get("id"));
            List<Map<String, Object>> mappings = client.get()
                    .uri("/admin/realms/{realm}/users/{id}/role-mappings/realm", config.realm(), id)
                    .headers(h -> h.setBearerAuth(token))
                    .retrieve()
                    .body(LIST);
            String role = null;
            for (Map<String, Object> m : mappings == null ? List.<Map<String, Object>>of() : mappings) {
                String name = Json.str(m.get("name"));
                if (APP_ROLES.contains(name)) {
                    role = name;
                    break;
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", id);
            row.put("username", u.get("username"));
            row.put("email", u.get("email"));
            row.put("enabled", u.get("enabled"));
            row.put("role", role);
            out.add(row);
        }
        return out;
    }

    /** Cree l'utilisateur (mot de passe definitif) et lui assigne son role. Retourne l'identifiant Keycloak. */
    public String createUser(String username, String email, String password, String role) {
        String token = adminToken();
        Map<String, Object> credential = Map.of("type", "password", "value", password, "temporary", false);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("username", username);
        payload.put("email", email);
        payload.put("enabled", true);
        payload.put("emailVerified", true);
        // Keycloak 26 (user profile) exige prenom/nom ; sans eux (ou avec des actions requises), la connexion
        // reste bloquee sur "Account is not fully set up". Meme precaution que recreate_users.py.
        payload.put("firstName", username);
        payload.put("lastName", "ZTB");
        payload.put("requiredActions", List.of());
        payload.put("credentials", List.of(credential));

        ResponseEntity<Void> created = client.post()
                .uri("/admin/realms/{realm}/users", config.realm())
                .headers(h -> h.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
        String location = created.getHeaders().getFirst(HttpHeaders.LOCATION);
        if (location == null) {
            throw new IllegalStateException("Keycloak n'a pas renvoye l'identifiant de l'utilisateur cree");
        }
        String id = location.substring(location.lastIndexOf('/') + 1);

        Map<String, Object> roleRepresentation = client.get()
                .uri("/admin/realms/{realm}/roles/{role}", config.realm(), role)
                .headers(h -> h.setBearerAuth(token))
                .retrieve()
                .body(MAP);
        client.post()
                .uri("/admin/realms/{realm}/users/{id}/role-mappings/realm", config.realm(), id)
                .headers(h -> h.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(List.of(roleRepresentation))
                .retrieve()
                .toBodilessEntity();
        return id;
    }

    /** Desactive le compte et coupe ses sessions Keycloak. Sans effet si l'utilisateur n'existe pas. */
    public boolean disableUser(String username) {
        String token = adminToken();
        List<Map<String, Object>> found = client.get()
                .uri("/admin/realms/{realm}/users?username={u}&exact=true", config.realm(), username)
                .headers(h -> h.setBearerAuth(token))
                .retrieve()
                .body(LIST);
        if (found == null || found.isEmpty()) {
            return false;
        }
        String id = Json.str(found.get(0).get("id"));
        client.put()
                .uri("/admin/realms/{realm}/users/{id}", config.realm(), id)
                .headers(h -> h.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("enabled", false))
                .retrieve()
                .toBodilessEntity();
        client.post()
                .uri("/admin/realms/{realm}/users/{id}/logout", config.realm(), id)
                .headers(h -> h.setBearerAuth(token))
                .retrieve()
                .toBodilessEntity();
        return true;
    }

    /** Suppression (compensation si l'enregistrement on-chain echoue apres la creation du compte). */
    public void deleteUser(String id) {
        String token = adminToken();
        client.delete()
                .uri("/admin/realms/{realm}/users/{id}", config.realm(), id)
                .headers(h -> h.setBearerAuth(token))
                .retrieve()
                .toBodilessEntity();
    }
}
