package com.ztb.evcharge.web;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** Traduit les erreurs des services amont (FastAPI, Keycloak) en reponses claires pour le frontend. */
@RestControllerAdvice
public class ApiExceptionHandler {

    /**
     * Erreur HTTP d'un service amont. Un 401/403/5xx amont devient un 502 : ce n'est pas le jeton du frontend
     * vers CE backend qui est en cause (sinon Angular croirait a tort que la session a expire).
     * Les autres 4xx (400, 404, 409...) sont repris tels quels.
     */
    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<Map<String, Object>> upstream(RestClientResponseException ex) {
        int upstream = ex.getStatusCode().value();
        HttpStatusCode out = (upstream == 401 || upstream == 403 || upstream >= 500)
                ? HttpStatusCode.valueOf(502)
                : ex.getStatusCode();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "upstream_error");
        body.put("upstreamStatus", upstream);
        body.put("detail", ex.getResponseBodyAsString());
        return ResponseEntity.status(out).body(body);
    }

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<Map<String, Object>> unreachable(ResourceAccessException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "service_unreachable");
        body.put("detail", "Un service requis (API Zero Trust ou Keycloak) est injoignable : " + ex.getMessage());
        return ResponseEntity.status(503).body(body);
    }

    /** Erreur metier levee par un controleur : le message (en francais) est renvoye au frontend. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> status(ResponseStatusException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "request_rejected");
        body.put("detail", ex.getReason() != null ? ex.getReason() : ex.getStatusCode().toString());
        return ResponseEntity.status(ex.getStatusCode()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> invalid(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e -> fields.put(e.getField(), e.getDefaultMessage()));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "validation_error");
        body.put("fields", fields);
        return ResponseEntity.badRequest().body(body);
    }
}
