package com.local.ar44.service;

import com.local.ar44.dto.AppConfig;
import com.local.ar44.repo.AppConfigRepository;
import org.springframework.stereotype.Service;

@Service
public class AppConfigService {

    private final AppConfigRepository repository;

    public AppConfigService(AppConfigRepository repository) {
        this.repository = repository;
    }

    public String getHost() {
        return repository.findAll()
                .stream()
                .findFirst()
                .map(AppConfig::getMediaHost)
                .orElse(null);
    }

    public String setHost(String host) {
        AppConfig config = repository.findAll()
                .stream()
                .findFirst()
                .orElse(new AppConfig());

        config.setMediaHost(host);
        repository.save(config);

        return host;
    }

    public boolean login(String username, String password) {
        return repository.findAll()
                .stream()
                .findFirst()
                .map(config -> {
                    String storedUser = config.getUsername();
                    String storedPass = config.getPassword();
                    return username.equals(storedUser) && password.equals(storedPass);
                })
                .orElse(false);
    }

    public void setCredentials(String username, String password) {
        AppConfig config = repository.findAll()
                .stream()
                .findFirst()
                .orElse(new AppConfig());

        config.setUsername(username);
        config.setPassword(password);
        repository.save(config);
    }

    public boolean verifyPassword(String password) {
        return repository.findAll()
                .stream()
                .findFirst()
                .map(config -> password != null && password.equals(config.getPassword()))
                .orElse(false);
    }

    public boolean hasCredentials() {
        return repository.findAll()
                .stream()
                .findFirst()
                .map(config -> config.getUsername() != null && !config.getUsername().isEmpty()
                        && config.getPassword() != null && !config.getPassword().isEmpty())
                .orElse(false);
    }
}
