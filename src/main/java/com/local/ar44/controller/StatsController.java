package com.local.ar44.controller;

import com.local.ar44.service.AppConfigService;
import com.local.ar44.service.StatsService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/stats")
public class StatsController {
    private final StatsService statsService;
    private final AppConfigService appConfigService;

    public StatsController(StatsService statsService, AppConfigService appConfigService) {
        this.statsService = statsService;
        this.appConfigService = appConfigService;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> overview() {
        return ResponseEntity.ok(statsService.getOverview());
    }

    @PostMapping("/access")
    public ResponseEntity<Void> logAccess(@RequestParam String page, HttpSession session) {
        statsService.logAccess(page, (String) session.getAttribute("username"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset")
    public ResponseEntity<String> resetCounters(@RequestBody Map<String, String> body) {
        String password = body.get("password");
        if (!appConfigService.verifyPassword(password)) {
            return ResponseEntity.status(401).body("Mot de passe incorrect");
        }
        statsService.resetCounters();
        return ResponseEntity.ok("Statistiques réinitialisées");
    }
}
