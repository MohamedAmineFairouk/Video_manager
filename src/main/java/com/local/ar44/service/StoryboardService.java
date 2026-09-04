package com.local.ar44.service;

import com.local.ar44.dto.Video;
import com.local.ar44.repo.VideoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Generates a scrub-preview "storyboard" sprite sheet per video: a single
 * JPEG tiling STORYBOARD_COLS x STORYBOARD_ROWS frames sampled evenly across
 * the video's duration, used by the player's seek bar hover preview.
 */
@Service
public class StoryboardService {

    private static final Logger log = LoggerFactory.getLogger(StoryboardService.class);

    public static final int COLS = 5;
    public static final int ROWS = 4;
    public static final int FRAME_COUNT = COLS * ROWS;
    public static final int TILE_WIDTH = 160;
    public static final int TILE_HEIGHT = 90;

    private final VideoRepository videoRepository;
    private final ThumbnailStorageService thumbnailStorageService;
    private final String videosDir;

    public StoryboardService(VideoRepository videoRepository,
                              ThumbnailStorageService thumbnailStorageService,
                              @Value("${app.videos.dir}") String videosDir) {
        this.videoRepository = videoRepository;
        this.thumbnailStorageService = thumbnailStorageService;
        this.videosDir = videosDir;
    }

    public Map<String, Object> generateAll() {
        List<Video> videos = videoRepository.findAll();
        int generated = 0;
        int skippedExisting = 0;
        int skippedNoDuration = 0;
        int failed = 0;

        for (Video video : videos) {
            Path storyboardPath = thumbnailStorageService.getStoryboardPath(video.getId());
            if (Files.exists(storyboardPath) && fileSizeSafe(storyboardPath) > 0) {
                skippedExisting++;
                continue;
            }
            if (video.getDurationMs() == null || video.getDurationMs() <= 0) {
                skippedNoDuration++;
                continue;
            }
            if (video.getFileName() == null || video.getFileName().isBlank()) {
                skippedNoDuration++;
                continue;
            }
            boolean ok = generateOne(video, storyboardPath);
            if (ok) generated++; else failed++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("generated", generated);
        result.put("skippedExisting", skippedExisting);
        result.put("skippedNoDuration", skippedNoDuration);
        result.put("failed", failed);
        return result;
    }

    private boolean generateOne(Video video, Path outputPath) {
        try {
            Path inputPath = Paths.get(videosDir, video.getFileName()).toAbsolutePath();
            if (!Files.exists(inputPath)) return false;

            double durationSeconds = video.getDurationMs() / 1000.0;
            double fps = FRAME_COUNT / durationSeconds;

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y",
                    "-i", inputPath.toString(),
                    "-vf", String.format(
                            java.util.Locale.ROOT,
                            "fps=%f,scale=%d:%d,tile=%dx%d",
                            fps, TILE_WIDTH, TILE_HEIGHT, COLS, ROWS
                    ),
                    "-frames:v", "1",
                    "-update", "1",
                    "-q:v", "4",
                    outputPath.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            // Drain output to avoid the process blocking on a full stdout buffer.
            try (var in = process.getInputStream()) {
                in.readAllBytes();
            }
            int exitCode = process.waitFor();

            if (exitCode != 0 || !Files.exists(outputPath) || fileSizeSafe(outputPath) == 0) {
                log.warn("[STORYBOARD] Échec génération pour vidéo id={} ({})", video.getId(), video.getFileName());
                return false;
            }
            return true;
        } catch (Exception e) {
            log.warn("[STORYBOARD] Erreur génération pour vidéo id={}: {}", video.getId(), e.getMessage());
            return false;
        }
    }

    private long fileSizeSafe(Path path) {
        try {
            return Files.size(path);
        } catch (Exception e) {
            return 0;
        }
    }
}
