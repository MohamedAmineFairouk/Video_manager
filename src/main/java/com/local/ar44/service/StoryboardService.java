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
import java.util.Locale;
import java.util.Map;

/**
 * Generates a scrub-preview "storyboard" sprite sheet per video: a single
 * JPEG tiling STORYBOARD_COLS x STORYBOARD_ROWS frames sampled evenly across
 * the video's duration, used by the player's seek bar hover preview.
 *
 * Source videos are stored obfuscated on disk (see FileObfuscationService),
 * so ffmpeg can't read them directly: each run de-obfuscates to a throwaway
 * temp file next to the source (same drive), lets ffmpeg build the sprite
 * from that, then obfuscates the resulting JPEG into its final storage path
 * and deletes the temp file.
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
    private final FileObfuscationService fileObfuscationService;
    private final Path videosDir;

    public StoryboardService(VideoRepository videoRepository,
                              ThumbnailStorageService thumbnailStorageService,
                              FileObfuscationService fileObfuscationService,
                              @Value("${app.videos.dir}") String videosDir) {
        this.videoRepository = videoRepository;
        this.thumbnailStorageService = thumbnailStorageService;
        this.fileObfuscationService = fileObfuscationService;
        this.videosDir = Paths.get(videosDir);
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
        Path inputPath = videosDir.resolve(video.getFileName()).toAbsolutePath();
        if (!Files.exists(inputPath)) return false;

        Path tempPlainVideo = null;
        Path tempPlainOutput = null;
        try {
            tempPlainVideo = Files.createTempFile(videosDir, "storyboard-src-", ".mp4");
            deobfuscateToFile(inputPath, tempPlainVideo);
            tempPlainOutput = Files.createTempFile(videosDir, "storyboard-out-", ".jpg");

            double durationSeconds = video.getDurationMs() / 1000.0;
            double fps = FRAME_COUNT / durationSeconds;

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y",
                    "-i", tempPlainVideo.toString(),
                    "-vf", String.format(
                            Locale.ROOT,
                            "fps=%f,scale=%d:%d,tile=%dx%d",
                            fps, TILE_WIDTH, TILE_HEIGHT, COLS, ROWS
                    ),
                    "-frames:v", "1",
                    "-update", "1",
                    "-q:v", "4",
                    tempPlainOutput.toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            // Drain output to avoid the process blocking on a full stdout buffer.
            try (var in = process.getInputStream()) {
                in.readAllBytes();
            }
            int exitCode = process.waitFor();

            if (exitCode != 0 || !Files.exists(tempPlainOutput) || fileSizeSafe(tempPlainOutput) == 0) {
                log.warn("[STORYBOARD] Échec génération pour vidéo id={} ({})", video.getId(), video.getFileName());
                return false;
            }

            byte[] obfuscated = fileObfuscationService.transform(Files.readAllBytes(tempPlainOutput));
            Files.write(outputPath, obfuscated);
            return true;
        } catch (Exception e) {
            log.warn("[STORYBOARD] Erreur génération pour vidéo id={}: {}", video.getId(), e.getMessage());
            return false;
        } finally {
            deleteQuietly(tempPlainVideo);
            deleteQuietly(tempPlainOutput);
        }
    }

    private void deobfuscateToFile(Path src, Path dest) throws Exception {
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

    private void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (Exception ignored) {
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
