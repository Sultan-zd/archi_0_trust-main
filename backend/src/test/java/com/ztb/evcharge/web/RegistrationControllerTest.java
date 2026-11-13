package com.ztb.evcharge.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ztb.evcharge.security.RegistrationRateLimiter;
import com.ztb.evcharge.service.AccountService;
import com.ztb.evcharge.web.dto.RegistrationRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

class RegistrationControllerTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
    private AccountService accounts;
    private RegistrationRateLimiter limiter;
    private RegistrationController controller;
    private MockHttpServletRequest http;

    @BeforeEach
    void setUp() {
        accounts = mock(AccountService.class);
        limiter = mock(RegistrationRateLimiter.class);
        when(limiter.tryAcquire(anyString())).thenReturn(true);
        controller = new RegistrationController(accounts, limiter);
        http = new MockHttpServletRequest();
        http.setRemoteAddr("203.0.113.7");
    }

    private static RegistrationRequest request(String username, String password, String website) {
        return new RegistrationRequest(username, "Nina@Example.com", password, "Lyon", true, website);
    }

    @Test
    void createsAUserAccountWithForcedRoleAndNormalizedEmail() {
        controller.register(request("nina", "Recharge2026", null), http);
        verify(accounts).create("nina", "nina@example.com", "Recharge2026", "User", "Lyon");
    }

    @Test
    void honeypotPretendsSuccessWithoutCreatingAnything() {
        var out = controller.register(request("bot", "Recharge2026", "http://spam.example"), http);
        assertEquals("bot", out.get("username"));
        verify(accounts, never()).create(any(), any(), any(), any(), any());
        verify(limiter, never()).tryAcquire(anyString());
    }

    @Test
    void rejectsAPasswordContainingTheUsername() {
        var ex = assertThrows(ResponseStatusException.class, () -> controller.register(request("nina", "nina2026xyz", null), http));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        verify(accounts, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    void returns429WhenTheRateLimitIsReached() {
        when(limiter.tryAcquire("203.0.113.7")).thenReturn(false);
        var ex = assertThrows(ResponseStatusException.class, () -> controller.register(request("nina", "Recharge2026", null), http));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());
        verify(accounts, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    void validationRejectsWeakPasswordsBadUsernamesAndMissingConsent() {
        assertTrue(validator.validate(request("nina", "Recharge2026", null)).isEmpty());
        assertEquals(1, validator.validate(request("nina", "court1", null)).size());
        assertEquals(1, validator.validate(request("nina", "sanschiffreici", null)).size());
        assertEquals(1, validator.validate(request("Nina Admin", "Recharge2026", null)).size());
        assertEquals(1, validator.validate(new RegistrationRequest("nina", "nina@example.com", "Recharge2026", "Lyon", false, null)).size());
    }
}
