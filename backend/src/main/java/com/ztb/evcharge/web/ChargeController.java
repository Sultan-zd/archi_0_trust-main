package com.ztb.evcharge.web;

import com.ztb.evcharge.client.FastApiClient;
import com.ztb.evcharge.domain.ChargeSession;
import com.ztb.evcharge.domain.ChargeStatus;
import com.ztb.evcharge.repo.ChargeSessionRepository;
import com.ztb.evcharge.repo.StationRepository;
import com.ztb.evcharge.service.ChargeService;
import com.ztb.evcharge.web.dto.ChargeRequest;
import com.ztb.evcharge.web.dto.ChargeResult;
import com.ztb.evcharge.web.dto.ChargeSessionDto;
import com.ztb.evcharge.web.dto.Decision;
import com.ztb.evcharge.web.dto.StationDto;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ChargeController {

    private final ChargeService service;
    private final StationRepository stations;
    private final ChargeSessionRepository sessions;
    private final FastApiClient fastApi;

    public ChargeController(ChargeService service, StationRepository stations, ChargeSessionRepository sessions,
                            FastApiClient fastApi) {
        this.service = service;
        this.stations = stations;
        this.sessions = sessions;
        this.fastApi = fastApi;
    }

    @GetMapping("/stations")
    public List<StationDto> stations(@AuthenticationPrincipal Jwt jwt, Authentication auth) {
        String me = jwt.getClaimAsString("preferred_username");
        boolean admin = isAdmin(auth);
        return stations.findAll().stream()
                .map(s -> {
                    Optional<ChargeSession> active = sessions.findFirstByStationIdAndStatus(s.getId(), ChargeStatus.ACTIVE);
                    Long activeId = active.map(ChargeSession::getId).orElse(null);
                    boolean canStop = active.map(a -> admin || a.getUsername().equals(me)).orElse(false);
                    // Qui utilise la borne n'est communique qu'a un Admin (supervision), pas aux autres utilisateurs.
                    String activeUser = admin ? active.map(ChargeSession::getUsername).orElse(null) : null;
                    return new StationDto(s.getId(), s.getCode(), s.getName(), s.getCity(), s.getPowerKw(),
                            active.isEmpty(), activeId, activeUser, canStop);
                })
                .toList();
    }

    /** Demande de charge : decision Zero Trust (ALLOW / MFA / DENY). Rejouer avec {"otp": "123456"} apres un MFA. */
    @PostMapping("/stations/{id}/charge")
    public ChargeResult start(@PathVariable Long id, @RequestBody(required = false) ChargeRequest body,
                              @AuthenticationPrincipal Jwt jwt) {
        return service.start(id, jwt.getClaimAsString("preferred_username"), jwt.getTokenValue(), body);
    }

    @GetMapping("/sessions")
    public List<ChargeSessionDto> mySessions(@AuthenticationPrincipal Jwt jwt) {
        return sessions.findByUsernameOrderByStartedAtDesc(jwt.getClaimAsString("preferred_username")).stream()
                .map(ChargeSessionDto::from)
                .toList();
    }

    @PostMapping("/sessions/{id}/stop")
    public ChargeResult stop(@PathVariable Long id, @RequestBody(required = false) ChargeRequest body,
                             @AuthenticationPrincipal Jwt jwt, Authentication auth) {
        return service.stop(id, jwt.getClaimAsString("preferred_username"), isAdmin(auth), jwt.getTokenValue(), body);
    }

    private static boolean isAdmin(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a -> "ROLE_Admin".equals(a.getAuthority()));
    }

    /**
     * Controle d'acces generique sur un micro-segment (charge:start, billing:read, fleet:dashboard, admin:firmware...).
     * Permet de montrer la micro-segmentation : le meme utilisateur est accepte ou refuse selon la ressource.
     */
    @PostMapping("/access/{resource}")
    public Decision check(@PathVariable String resource, @RequestBody(required = false) ChargeRequest body,
                          @AuthenticationPrincipal Jwt jwt) {
        if (!fastApi.resources().containsKey(resource)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource inconnue : " + resource);
        }
        return service.check(resource, jwt.getTokenValue(), body);
    }

    /** Ressources (micro-segments) et leurs seuils, lus depuis le smart contract AccessPolicy. */
    @GetMapping("/resources")
    public Object resources() {
        return fastApi.resources();
    }
}
