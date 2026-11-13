package com.ztb.evcharge.web;

import com.ztb.evcharge.security.RegistrationRateLimiter;
import com.ztb.evcharge.service.AccountService;
import com.ztb.evcharge.web.dto.RegistrationRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Inscription en libre-service (sans authentification). Le compte cree a toujours le role "User" ;
 * l'utilisateur active ensuite sa MFA depuis son espace (ecran « Activer la MFA »).
 */
@RestController
@RequestMapping("/api/public")
public class RegistrationController {

    static final String SELF_SERVICE_ROLE = "User";

    private final AccountService accounts;
    private final RegistrationRateLimiter limiter;

    public RegistrationController(AccountService accounts, RegistrationRateLimiter limiter) {
        this.accounts = accounts;
        this.limiter = limiter;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> register(@Valid @RequestBody RegistrationRequest req, HttpServletRequest http) {
        String username = req.username().trim().toLowerCase(Locale.ROOT);
        Map<String, Object> created = Map.of("username", username, "role", SELF_SERVICE_ROLE);

        // Piege a robots rempli : on repond comme si tout allait bien, sans rien creer.
        if (req.website() != null && !req.website().isBlank()) {
            return created;
        }
        if (req.password().toLowerCase(Locale.ROOT).contains(username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le mot de passe ne doit pas contenir l'identifiant");
        }
        if (!limiter.tryAcquire(http.getRemoteAddr())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Trop d'inscriptions depuis cette adresse. Reessayez dans une heure.");
        }
        accounts.create(username, req.email().trim().toLowerCase(Locale.ROOT), req.password(), SELF_SERVICE_ROLE, req.homeLocation());
        return created;
    }
}
