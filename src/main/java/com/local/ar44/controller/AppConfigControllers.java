package com.local.ar44.controller;

import com.local.ar44.service.AppConfigService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/config")
public class AppConfigControllers {

    private final AppConfigService service;

    public AppConfigControllers(AppConfigService service) {
        this.service = service;
    }

    // 🔹 GET → récupérer le host
    @GetMapping("/host")
    public ResponseEntity<String> getHost() {
        String host = service.getHost();
        return ResponseEntity.ok(host != null ? host : "non défini");
    }

    // 🔹 POST → modifier le host
    @GetMapping("/host/set")
    public ResponseEntity<String> setHost(@RequestParam String host, HttpSession session) {
        service.setHost(host);
        session.setAttribute("mediaHost", host);
        return ResponseEntity.ok("Host mis à jour : " + host);
    }

    // 🔹 POST → login (code PIN)
    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestParam String pin, HttpSession session) {
        if (service.login(pin)) {
            session.setAttribute("authenticated", true);
            session.setAttribute("username", "user");
            return ResponseEntity.ok("Authentification réussie");
        }
        return ResponseEntity.status(401).body("Code incorrect");
    }

    // 🔹 POST → définir le code PIN (première configuration)
    @PostMapping("/credentials/set")
    public ResponseEntity<String> setPin(@RequestParam String pin) {
        service.setPin(pin);
        return ResponseEntity.ok("Code configuré");
    }

    // 🔹 GET → vérifier si un code PIN existe déjà
    @GetMapping("/credentials/exists")
    public ResponseEntity<Boolean> credentialsExist() {
        return ResponseEntity.ok(service.hasPin());
    }

    // 🔹 POST → changer le code PIN (nécessite l'ancien code)
    @PostMapping("/pin/change")
    public ResponseEntity<String> changePin(@RequestBody java.util.Map<String, String> body) {
        String oldPin = body.get("oldPin");
        String newPin = body.get("newPin");
        if (!service.verifyPin(oldPin)) {
            return ResponseEntity.status(401).body("Code actuel incorrect");
        }
        if (newPin == null || newPin.length() != 4) {
            return ResponseEntity.badRequest().body("Le nouveau code doit contenir 4 chiffres");
        }
        service.setPin(newPin);
        return ResponseEntity.ok("Code mis à jour");
    }

    // 🔹 GET → vérifier authentification
    @GetMapping("/auth/check")
    public ResponseEntity<Boolean> checkAuth(HttpSession session) {
        Boolean authenticated = (Boolean) session.getAttribute("authenticated");
        return ResponseEntity.ok(authenticated != null && authenticated);
    }

    // 🔹 GET → logout
    @GetMapping("/logout")
    public ResponseEntity<String> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok("Déconnecté");
    }
}