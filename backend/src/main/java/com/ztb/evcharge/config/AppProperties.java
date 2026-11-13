package com.ztb.evcharge.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration de l'application, lue sous le prefixe "app" dans application.yml. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Keycloak keycloak, FastApi fastapi, Cors cors) {

    public record Keycloak(String baseUrl, String realm, String adminUsername, String adminPassword,
                           List<String> allowedIssuers) {
        public String jwkSetUri() {
            return baseUrl + "/realms/" + realm + "/protocol/openid-connect/certs";
        }
    }

    public record FastApi(String baseUrl, String adminApiKey, String flowSample, int flowIndex) {
    }

    public record Cors(List<String> allowedOrigins) {
    }
}
