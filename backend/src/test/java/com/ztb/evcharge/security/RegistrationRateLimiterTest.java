package com.ztb.evcharge.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class RegistrationRateLimiterTest {

    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-13T10:00:00Z");
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void limitsEachClientAndResetsAfterTheWindow() {
        MutableClock clock = new MutableClock();
        RegistrationRateLimiter limiter = new RegistrationRateLimiter(clock, 5, 100);
        for (int i = 0; i < 5; i++) {
            assertTrue(limiter.tryAcquire("1.2.3.4"));
        }
        assertFalse(limiter.tryAcquire("1.2.3.4"));
        assertTrue(limiter.tryAcquire("5.6.7.8"), "un autre client n'est pas bloque");

        clock.now = clock.now.plus(RegistrationRateLimiter.WINDOW).plus(Duration.ofSeconds(1));
        assertTrue(limiter.tryAcquire("1.2.3.4"), "la fenetre glissante est ecoulee");
    }

    @Test
    void appliesAGlobalLimit() {
        RegistrationRateLimiter limiter = new RegistrationRateLimiter(new MutableClock(), 5, 100);
        for (int i = 0; i < 100; i++) {
            assertTrue(limiter.tryAcquire("client-" + i));
        }
        assertFalse(limiter.tryAcquire("nouveau-client"));
    }
}
