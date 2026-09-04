package com.local.ar44.service;

import com.local.ar44.dto.Video;
import com.local.ar44.repo.VideoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * One-shot migration: obfuscates videos/thumbnails/storyboards that still
 * sit on disk in plain, directly-openable form (from before
 * FileObfuscationService existed) and updates each Video row's fileName to
 * the new .arv extension. Safe to call repeatedly — anything already
 * migrated is skipped.
 */
@Service
public class ObfuscationMigrationService {

    private static final Logger log = LoggerFactory.getLogger(ObfuscationMigrationService.class);
    private static final Pattern NUMBERED_VIDEO_NAME = Pattern.compile("^vid_(\\d+)$", Pattern.CASE_INSENSITIVE);

    private final VideoRepository videoRepository;
    private final ThumbnailStorageService thumbnailStorageService;
    private final FileObfuscationService fileObfuscationService;
    private final Path videosDir;
    private final Path thumbsDir;

    public ObfuscationMigrationService(VideoRepository videoRepository,
                                        ThumbnailStorageService thumbnailStorageService,
                                        FileObfuscationService fileObfuscationService,
                                        @Value("${app.videos.dir}") String videosDir,
                                        @Value("${app.thumbnails.dir:thumbnails}") String thumbnailsDir) {
        this.videoRepository = videoRepository;
        this.thumbnailStorageService = thumbnailStorageService;
        this.fileObfuscationService = fileObfuscationService;
        this.videosDir = Paths.get(videosDir).toAbsolutePath();
        this.thumbsDir = Paths.get(thumbnailsDir).toAbsolutePath();
    }

    public Map<String, Object> migrateExisting() {
        List<Video> videos = videoRepository.findAll();

        int videosMigrated = 0, videosSkipped = 0, videosFailed = 0;
        int thumbsMigrated = 0, thumbsSkipped = 0, thumbsFailed = 0;
        int storyboardsMigrated = 0, storyboardsSkipped = 0, storyboardsFailed = 0;

        for (Video video : videos) {
            String fileName = video.getFileName();
            if (fileName == null || fileName.isBlank()) continue;

            // Compute the legacy plain thumbnail path BEFORE the video's fileName (and
            // therefore its base name) is potentially rewritten below.
            Path legacyThumbPath = legacyThumbPath(fileName);

            // --- Video file ---
            if (!extensionOf(fileName).equals(FileObfuscationService.VIDEO_EXTENSION)) {
                Path plainVideoPath = videosDir.resolve(fileName);
                if (Files.exists(plainVideoPath)) {
                    String baseName = baseNameOf(fileName);
                    Path obfuscatedPath = videosDir.resolve(baseName + "." + FileObfuscationService.VIDEO_EXTENSION);
                    try {
                        streamTransform(plainVideoPath, obfuscatedPath);
                        Files.delete(plainVideoPath);
                        video.setFileName(obfuscatedPath.getFileName().toString());
                        videoRepository.save(video);
                        videosMigrated++;
                    } catch (Exception e) {
                        log.warn("[MIGRATE] Échec vidéo id={}: {}", video.getId(), e.getMessage());
                        videosFailed++;
                    }
                } else {
                    videosSkipped++;
                }
            } else {
                videosSkipped++;
            }

            // --- Thumbnail (legacy plain -> new .ari path resolved from the *updated* fileName) ---
            Path newThumbPath = thumbnailStorageService.getThumbPath(video.getFileName());
            if (legacyThumbPath != null && Files.exists(legacyThumbPath)) {
                try {
                    byte[] obfuscated = fileObfuscationService.transform(Files.readAllBytes(legacyThumbPath));
                    Files.write(newThumbPath, obfuscated);
                    Files.delete(legacyThumbPath);
                    thumbsMigrated++;
                } catch (Exception e) {
                    log.warn("[MIGRATE] Échec thumbnail id={}: {}", video.getId(), e.getMessage());
                    thumbsFailed++;
                }
            } else {
                thumbsSkipped++;
            }

            // --- Storyboard (legacy storyboard_{id}.jpg -> storyboard_{id}.ari) ---
            Path legacyStoryboardPath = thumbsDir.resolve("storyboard_" + video.getId() + ".jpg");
            Path newStoryboardPath = thumbnailStorageService.getStoryboardPath(video.getId());
            if (Files.exists(legacyStoryboardPath)) {
                try {
                    byte[] obfuscated = fileObfuscationService.transform(Files.readAllBytes(legacyStoryboardPath));
                    Files.write(newStoryboardPath, obfuscated);
                    Files.delete(legacyStoryboardPath);
                    storyboardsMigrated++;
                } catch (Exception e) {
                    log.warn("[MIGRATE] Échec storyboard id={}: {}", video.getId(), e.getMessage());
                    storyboardsFailed++;
                }
            } else {
                storyboardsSkipped++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("videosMigrated", videosMigrated);
        result.put("videosSkipped", videosSkipped);
        result.put("videosFailed", videosFailed);
        result.put("thumbsMigrated", thumbsMigrated);
        result.put("thumbsSkipped", thumbsSkipped);
        result.put("thumbsFailed", thumbsFailed);
        result.put("storyboardsMigrated", storyboardsMigrated);
        result.put("storyboardsSkipped", storyboardsSkipped);
        result.put("storyboardsFailed", storyboardsFailed);
        return result;
    }

    /** Reproduces the pre-migration (plain .jpg) thumbnail naming convention. */
    private Path legacyThumbPath(String videoFileName) {
        String baseName = baseNameOf(videoFileName);
        Matcher m = NUMBERED_VIDEO_NAME.matcher(baseName);
        String legacyName = m.matches() ? "thumb_" + m.group(1) + ".jpg" : baseName + ".jpg";
        return thumbsDir.resolve(legacyName);
    }

    private void streamTransform(Path src, Path dest) throws Exception {
        try (InputStream in = Files.newInputStream(src); OutputStream out = Files.newOutputStream(dest)) {
            byte[] buffer = new byte[64 * 1024];
            long pos = 0;
            int read;
            while ((read = in.read(buffer)) != -1) {
                fileObfuscationService.transform(buffer, 0, read, pos);
                out.write(buffer, 0, read);
                pos += read;
            }
        }
    }

    private String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot >= 0 ? fileName.substring(dot + 1).toLowerCase() : "";
    }

    private String baseNameOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }
}
