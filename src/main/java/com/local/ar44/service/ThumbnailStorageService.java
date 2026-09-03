package com.local.ar44.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ThumbnailStorageService {
    private static final Logger log = LoggerFactory.getLogger(ThumbnailStorageService.class);
    private static final Pattern NUMBERED_VIDEO_NAME = Pattern.compile("^vid_(\\d+)$", Pattern.CASE_INSENSITIVE);

    private final Path thumbsDir;

    public ThumbnailStorageService(
            @Value("${app.thumbnails.dir:thumbnails}") String thumbnailsDir
    ) {
        this.thumbsDir = Paths.get(thumbnailsDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() throws IOException {
        Files.createDirectories(thumbsDir);
        log.info("[THUMBNAILS] Répertoire des thumbnails initialisé: {}", thumbsDir.toAbsolutePath());
    }

    public Path getThumbPath(Long videoId) {
        return thumbsDir.resolve(videoId + ".jpg");
    }

    public Path getThumbPath(String videoFileName) {
        String thumbName = toThumbnailName(videoFileName);
        Path result = thumbsDir.resolve(thumbName);
        log.debug("[THUMBNAILS] Calcul du chemin: VideoFileName={} -> ThumbName={} -> FullPath={}", 
                videoFileName, thumbName, result.toAbsolutePath());
        return result;
    }

    public String toThumbnailName(String videoFileName) {
        if (videoFileName == null || videoFileName.isBlank()) {
            log.warn("[THUMBNAILS] ⚠️  videoFileName est vide, throwing exception");
            throw new IllegalArgumentException("videoFileName ne doit pas être vide");
        }

        String cleanName = Paths.get(videoFileName).getFileName().toString();
        int dotIndex = cleanName.lastIndexOf('.');

        String baseName = (dotIndex > 0)
                ? cleanName.substring(0, dotIndex)
                : cleanName;
        
        Matcher numberedVideoName = NUMBERED_VIDEO_NAME.matcher(baseName);
        String result = numberedVideoName.matches()
                ? "thumb_" + numberedVideoName.group(1) + ".jpg"
                : baseName + ".jpg";
        log.debug("[THUMBNAILS] toThumbnailName: {} -> cleanName={} -> baseName={} -> result={}",
                videoFileName, cleanName, baseName, result);
        
        return result;
    }

    public boolean exists(String videoFileName) {
        return Files.exists(getThumbPath(videoFileName));
    }

    public boolean exists(Long videoId) {
        return Files.exists(getThumbPath(videoId));
    }

    public void cleanupTempIfNeeded() {
        // No-op
    }
}