package com.ztb.evcharge.web.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Inscription publique. Le role n'est pas un champ : un compte cree en libre-service est toujours "User".
 * "website" est un piege a robots : invisible pour un humain, il doit rester vide.
 */
public record RegistrationRequest(
        @NotBlank @Pattern(regexp = "^[a-z0-9._-]{3,30}$", message = "3 a 30 caracteres : minuscules, chiffres, . _ -")
        String username,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 10, max = 128, message = "10 a 128 caracteres")
        @Pattern(regexp = "^(?=.*\\p{L})(?=.*\\d).+$", message = "au moins une lettre et un chiffre")
        String password,
        @Pattern(regexp = "^[\\p{L} '-]{2,40}$", message = "nom de ville invalide") String homeLocation,
        @AssertTrue(message = "acceptation requise") boolean acceptTerms,
        String website) {
}
