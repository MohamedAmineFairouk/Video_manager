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

    public boolean login(String pin) {
        return verifyPin(pin);
    }

    public void setPin(String pin) {
        AppConfig config = repository.findAll()
                .stream()
                .findFirst()
                .orElse(new AppConfig());

        config.setPin(pin);
        repository.save(config);
    }

    public boolean verifyPin(String pin) {
        return repository.findAll()
                .stream()
                .findFirst()
                .map(config -> pin != null && pin.equals(config.getPin()))
                .orElse(false);
    }

    public boolean hasPin() {
        return repository.findAll()
                .stream()
                .findFirst()
                .map(config -> config.getPin() != null && !config.getPin().isEmpty())
                .orElse(false);
    }
}
