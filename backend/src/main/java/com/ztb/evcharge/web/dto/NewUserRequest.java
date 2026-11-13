package com.ztb.evcharge.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record NewUserRequest(
        @NotBlank @Pattern(regexp = "^[a-z0-9._-]{3,30}$", message = "3 a 30 caracteres : minuscules, chiffres, . _ -")
        String username,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8, message = "8 caracteres minimum") String password,
        @NotBlank @Pattern(regexp = "User|Fleet|Admin", message = "User, Fleet ou Admin") String role,
        String homeLocation) {
}
