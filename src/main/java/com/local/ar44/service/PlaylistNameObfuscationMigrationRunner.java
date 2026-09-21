package com.local.ar44.service;

import com.local.ar44.converter.TitleObfuscationConverter;
import com.local.ar44.repo.PlaylistRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * One-shot startup migration: rewrites any playlist name still stored in
 * plain text (via a raw UPDATE, not the entity) to its obfuscated form, see
 * TitleObfuscationConverter. Safe to run on every boot — already-migrated
 * rows (OBF1: prefix) are found and skipped at the SQL level.
 */
@Component
public class PlaylistNameObfuscationMigrationRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(PlaylistNameObfuscationMigrationRunner.class);

    private final PlaylistRepository playlistRepository;
    private final TitleObfuscationConverter converter = new TitleObfuscationConverter();

    public PlaylistNameObfuscationMigrationRunner(PlaylistRepository playlistRepository) {
        this.playlistRepository = playlistRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<Object[]> rows = playlistRepository.findPlainNameRows();
        if (rows.isEmpty()) return;
        for (Object[] row : rows) {
            Long id = ((Number) row[0]).longValue();
            String plainName = (String) row[1];
            playlistRepository.updateNameRaw(id, converter.convertToDatabaseColumn(plainName));
        }
        log.info("Noms obfusqués pour {} playlist(s)", rows.size());
    }
}
