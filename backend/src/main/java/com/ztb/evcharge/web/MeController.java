package com.ztb.evcharge.web;

import com.ztb.evcharge.client.FastApiClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class MeController {

    private static final List<String> ROLE_ORDER = List.of("Admin", "Fleet", "User");

    private final FastApiClient fastApi;

    public MeController(FastApiClient fastApi) {
        this.fastApi = fastApi;
    }

    /** Profil de l'utilisateur connecte : claims du JWT + identite enregistree sur la blockchain (IdentityRegistry). */
    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt, Authentication auth) {
        List<String> roles = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring("ROLE_".length()))
                .filter(ROLE_ORDER::contains)
                .toList();
        String primary = ROLE_ORDER.stream().filter(roles::contains).findFirst().orElse(null);
        String username = jwt.getClaimAsString("preferred_username");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("username", username);
        out.put("email", jwt.getClaimAsString("email"));
        out.put("role", primary);
        out.put("roles", roles);
        try {
            out.put("identity", fastApi.identity(username));
        } catch (Exception e) {
            out.put("identity", null); // API Zero Trust injoignable : le profil reste disponible
        }
        return out;
    }
}
