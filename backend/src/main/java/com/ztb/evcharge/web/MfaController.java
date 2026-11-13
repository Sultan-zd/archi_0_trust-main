package com.ztb.evcharge.web;

import com.ztb.evcharge.client.FastApiClient;
import java.util.HashMap;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Activation de la MFA par l'utilisateur connecte (QR code a scanner avec Google / Microsoft Authenticator).
 * Le JWT de l'utilisateur est transmis a FastAPI, qui en tire l'identite : on ne peut agir que sur son propre compte,
 * et le secret n'est renvoye qu'au moment de l'activation (jamais apres, jamais a l'admin).
 */
@RestController
@RequestMapping("/api/mfa")
public class MfaController {

    private final FastApiClient fastApi;

    public MfaController(FastApiClient fastApi) {
        this.fastApi = fastApi;
    }

    @GetMapping("/status")
    public Map<String, Object> status(@AuthenticationPrincipal Jwt jwt) {
        return fastApi.mfaStatus(jwt.getTokenValue());
    }

    /** Nouveau secret en attente. Pour un renouvellement, fournir {"currentOtp": "123456"} (code actuel). */
    @PostMapping("/enroll")
    public Map<String, Object> enroll(@RequestBody(required = false) Map<String, Object> body, @AuthenticationPrincipal Jwt jwt) {
        Map<String, Object> out = new HashMap<>();
        Object current = body == null ? null : body.get("currentOtp");
        if (current != null && !String.valueOf(current).isBlank()) {
            out.put("current_otp", String.valueOf(current).trim());
        }
        return fastApi.mfaEnroll(jwt.getTokenValue(), out);
    }

    /** Premier code genere par l'application : active la MFA s'il est valide. */
    @PostMapping("/confirm")
    public Map<String, Object> confirm(@RequestBody Map<String, Object> body, @AuthenticationPrincipal Jwt jwt) {
        Object otp = body == null ? null : body.get("otp");
        return fastApi.mfaConfirm(jwt.getTokenValue(), Map.of("otp", otp == null ? "" : String.valueOf(otp).trim()));
    }
}
