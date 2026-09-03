package com.local.ar44.controller;

import com.local.ar44.service.StatsService;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.servlet.view.RedirectView;
import jakarta.servlet.http.HttpSession;

@Controller
public class PageController {

    private final StatsService statsService;

    public PageController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @GetMapping("/")
    public Object index(HttpSession session) {
        if (session.getAttribute("authenticated") == null || !(boolean) session.getAttribute("authenticated")) {
            return new RedirectView("/login", true);
        }
        statsService.logAccess("index", (String) session.getAttribute("username"));
        return "index";
    }

    @GetMapping("/favorites")
    public Object favorites(HttpSession session) {
        if (session.getAttribute("authenticated") == null || !(boolean) session.getAttribute("authenticated")) {
            return new RedirectView("/login", true);
        }
        statsService.logAccess("favorites", (String) session.getAttribute("username"));
        return "favorites";
    }
    @GetMapping("/recently")
    public Object recently(HttpSession session) {
        if (session.getAttribute("authenticated") == null || !(boolean) session.getAttribute("authenticated")) {
            return new RedirectView("/login", true);
        }
        statsService.logAccess("recently", (String) session.getAttribute("username"));
        return "recently";
    }

    @GetMapping("/tags")
    public Object tags(HttpSession session) {
        if (session.getAttribute("authenticated") == null || !(boolean) session.getAttribute("authenticated")) {
            return new RedirectView("/login", true);
        }
        statsService.logAccess("tags", (String) session.getAttribute("username"));
        return "tags";
    }

    @GetMapping("/settings")
    public Object settings(HttpSession session) {
        if (session.getAttribute("authenticated") == null || !(boolean) session.getAttribute("authenticated")) {
            return new RedirectView("/login", true);
        }
        statsService.logAccess("settings", (String) session.getAttribute("username"));
        return "settings";
    }

    @GetMapping("/stats")
    public Object stats(HttpSession session) {
        if (session.getAttribute("authenticated") == null || !(boolean) session.getAttribute("authenticated")) {
            return new RedirectView("/login", true);
        }
        statsService.logAccess("stats", (String) session.getAttribute("username"));
        return "stats";
    }
}
