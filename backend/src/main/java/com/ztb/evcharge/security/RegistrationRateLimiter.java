package com.ztb.evcharge.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Limite les inscriptions publiques : chaque inscription cree un compte Keycloak et une transaction blockchain.
 * Fenetre glissante d'une heure, par adresse IP et au total. En memoire (une seule instance du backend).
 * Reglable par app.registration.max-per-client / max-global (variables ZTB_REGISTRATION_*).
 * Attention : derriere un NAT (Docker Desktop, proxy), tous les visiteurs peuvent partager la meme adresse.
 */
@Component
public class RegistrationRateLimiter {

    static final Duration WINDOW = Duration.ofHours(1);
    private static final String ALL = "*";

    private final Clock clock;
    private final int perClient;
    private final int global;
    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    @Autowired
    public RegistrationRateLimiter(@Value("${app.registration.max-per-client:20}") int perClient,
                                   @Value("${app.registration.max-global:200}") int global) {
        this(Clock.systemUTC(), perClient, global);
    }

    RegistrationRateLimiter(Clock clock, int perClient, int global) {
        this.clock = clock;
        this.perClient = perClient;
        this.global = global;
    }

    /** Enregistre une tentative ; false si la limite (par client ou globale) est atteinte. */
    public synchronized boolean tryAcquire(String client) {
        Instant now = clock.instant();
        Deque<Instant> mine = recent(client, now);
        Deque<Instant> all = recent(ALL, now);
        if (mine.size() >= perClient || all.size() >= global) {
            return false;
        }
        mine.addLast(now);
        all.addLast(now);
        if (hits.size() > 10_000) {
            hits.entrySet().removeIf(e -> e.getValue().isEmpty());
        }
        return true;
    }

    private Deque<Instant> recent(String key, Instant now) {
        Deque<Instant> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        Instant limit = now.minus(WINDOW);
        while (!q.isEmpty() && !q.peekFirst().isAfter(limit)) {
            q.pollFirst();
        }
        return q;
    }
}
