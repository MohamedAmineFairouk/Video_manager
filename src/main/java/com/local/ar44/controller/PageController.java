package com.local.ar44.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the React SPA's index.html for every client-side route so a hard
 * refresh (or a direct link) on e.g. /playlists/3 doesn't 404. The SPA itself
 * handles auth redirects and routing client-side; the build output lives in
 * src/main/resources/static (see frontend/vite.config.js outDir).
 */
@Controller
public class PageController {

    @GetMapping({
            "/", "/login", "/favorites", "/recently",
            "/playlists", "/playlists/{id}", "/settings", "/stats"
    })
    public String spa() {
        return "forward:/index.html";
    }
}
