package com.ztb.evcharge.web;

import com.ztb.evcharge.client.FastApiClient;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PublicController {

    private final FastApiClient fastApi;

    public PublicController(FastApiClient fastApi) {
        this.fastApi = fastApi;
    }

    /** Sante du backend et de l'API Zero Trust (sans authentification). */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("backend", "UP");
        try {
            Map<String, Object> h = fastApi.health();
            out.put("fastapi", "UP");
            out.put("chainId", h.get("chain_id"));
            out.put("block", h.get("block"));
        } catch (Exception e) {
            out.put("fastapi", "DOWN");
        }
        return out;
    }
}
