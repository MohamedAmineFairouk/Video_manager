package com.local.ar44.service;

import com.local.ar44.converter.TitleObfuscationConverter;
import com.local.ar44.repo.VideoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * One-shot startup migration: rewrites any video title still stored in plain
 * text (via a raw UPDATE, not the entity) to its obfuscated form, see
 * TitleObfuscationConverter. Safe to run on every boot — already-migrated
 * rows (OBF1: prefix) are found and skipped at the SQL level.
 */
@Component
public class TitleObfuscationMigrationRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(TitleObfuscationMigrationRunner.class);

    private final VideoRepository videoRepository;
    private final TitleObfuscationConverter converter = new TitleObfuscationConverter();

    public TitleObfuscationMigrationRunner(VideoRepository videoRepository) {
        this.videoRepository = videoRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<Object[]> rows = videoRepository.findPlainTitleRows();
        if (rows.isEmpty()) return;
        for (Object[] row : rows) {
            Long id = ((Number) row[0]).longValue();
            String plainTitle = (String) row[1];
            videoRepository.updateTitleRaw(id, converter.convertToDatabaseColumn(plainTitle));
        }
        log.info("Titres obfusqués pour {} vidéo(s)", rows.size());
    }
}
