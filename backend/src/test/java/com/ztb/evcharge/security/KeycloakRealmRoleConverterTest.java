package com.ztb.evcharge.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

class KeycloakRealmRoleConverterTest {

    private final KeycloakRealmRoleConverter converter = new KeycloakRealmRoleConverter();

    @Test
    void convertitLesRolesDuRealmEnAutorites() {
        Jwt jwt = Jwt.withTokenValue("t")
                .header("alg", "none")
                .claim("preferred_username", "root")
                .claim("realm_access", Map.of("roles", List.of("Admin", "offline_access")))
                .build();

        assertThat(converter.convert(jwt))
                .extracting(GrantedAuthority::getAuthority)
                .containsExactlyInAnyOrder("ROLE_Admin", "ROLE_offline_access");
    }

    @Test
    void retourneUneListeVideSansClaimRealmAccess() {
        Jwt jwt = Jwt.withTokenValue("t")
                .header("alg", "none")
                .claim("preferred_username", "alice")
                .build();

        assertThat(converter.convert(jwt)).isEmpty();
    }
}
