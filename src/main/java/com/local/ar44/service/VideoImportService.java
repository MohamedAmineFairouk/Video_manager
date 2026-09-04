package com.local.ar44.service;

import com.local.ar44.dto.Video;
import com.local.ar44.repo.VideoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.FileTime;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Scans the videos directory on disk and syncs it with the database.
 * Plain video files (mp4, mkv, ...) found with no matching DB row are
 * obfuscated in place (see FileObfuscationService) and renamed to the
 * internal .arv extension before being registered, so nothing playable
 * by an external player ever lingers on disk. Already-registered .arv
 * files are left untouched; existing rows missing a duration get it
 * backfilled via ffprobe run against the plain file before obfuscation.
 */
@Service
public class VideoImportService {

    private static final Logger log = LoggerFactory.getLogger(VideoImportService.class);
    private static final Set<String> PLAIN_VIDEO_EXTENSIONS = Set.of("mp4", "mkv", "avi", "mov", "webm", "m4v");

    private final VideoRepository videoRepository;
    private final FileObfuscationService fileObfuscationService;
    private final String videosDir;

    public VideoImportService(VideoRepository videoRepository,
                               FileObfuscationService fileObfuscationService,
                               @Value("${app.videos.dir}") String videosDir) {
        this.videoRepository = videoRepository;
        this.fileObfuscationService = fileObfuscationService;
        this.videosDir = videosDir;
    }

    public Map<String, Object> importFromDisk() {
        Path dir = Paths.get(videosDir);

        Map<String, Video> existingByFileName = new HashMap<>();
        for (Video v : videoRepository.findAll()) {
            if (v.getFileName() != null) existingByFileName.put(v.getFileName(), v);
        }

        List<Video> toCreate = new ArrayList<>();
        List<Video> toUpdate = new ArrayList<>();
        int skipped = 0;
        int scanned = 0;
        int failed = 0;

        if (Files.isDirectory(dir)) {
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
                for (Path path : stream) {
                    if (Files.isDirectory(path)) continue;
                    String fileName = path.getFileName().toString();
                    String ext = extensionOf(fileName);
                    boolean isObfuscated = ext.equals(FileObfuscationService.VIDEO_EXTENSION);
                    boolean isPlain = PLAIN_VIDEO_EXTENSIONS.contains(ext);
                    if (!isObfuscated && !isPlain) continue;
                    scanned++;

                    Video existing = existingByFileName.get(fileName);

                    if (isObfuscated) {
                        // Already processed at some point; nothing to (safely) do without a key-bearing tool.
                        skipped++;
                        continue;
                    }

                    // Plain file (mp4/mkv/...): probe duration first, then obfuscate + rename.
                    if (existing != null) {
                        if (existing.getDurationMs() == null) {
                            Long duration = probeDurationMs(path);
                            if (duration != null) {
                                existing.setDurationMs(duration);
                                toUpdate.add(existing);
                            } else {
                                skipped++;
                            }
                        } else {
                            skipped++;
                        }
                        continue;
                    }

                    Long duration = probeDurationMs(path);
                    String newFileName;
                    try {
                        newFileName = obfuscateAndRename(path);
                    } catch (IOException e) {
                        log.warn("[IMPORT] Échec du brouillage pour {}: {}", fileName, e.getMessage());
                        failed++;
                        continue;
                    }

                    Video video = new Video();
                    video.setFileName(newFileName);
                    video.setTitle(baseNameOf(fileName));
                    video.setCreatedAt(fileModifiedAt(path));
                    video.setDurationMs(duration);
                    toCreate.add(video);
                    existingByFileName.put(newFileName, video);
                }
            } catch (IOException e) {
                log.error("[IMPORT] Erreur lecture dossier vidéos: {}", e.getMessage());
            }
        }

        if (!toCreate.isEmpty()) videoRepository.saveAll(toCreate);
        if (!toUpdate.isEmpty()) videoRepository.saveAll(toUpdate);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scanned", scanned);
        result.put("imported", toCreate.size());
        result.put("durationsUpdated", toUpdate.size());
        result.put("skipped", skipped);
        result.put("failed", failed);
        return result;
    }

    private String obfuscateAndRename(Path plainPath) throws IOException {
        String baseName = baseNameOf(plainPath.getFileName().toString());
        Path obfuscatedPath = plainPath.getParent().resolve(baseName + "." + FileObfuscationService.VIDEO_EXTENSION);
        try (InputStream in = Files.newInputStream(plainPath);
             OutputStream out = Files.newOutputStream(obfuscatedPath)) {
            byte[] buffer = new byte[64 * 1024];
            long pos = 0;
            int read;
            while ((read = in.read(buffer)) != -1) {
                fileObfuscationService.transform(buffer, 0, read, pos);
                out.write(buffer, 0, read);
                pos += read;
            }
        }
        Files.delete(plainPath);
        return obfuscatedPath.getFileName().toString();
    }

    private String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot >= 0 ? fileName.substring(dot + 1).toLowerCase() : "";
    }

    private String baseNameOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }

    private LocalDateTime fileModifiedAt(Path path) {
        try {
            FileTime time = Files.getLastModifiedTime(path);
            return LocalDateTime.ofInstant(time.toInstant(), ZoneId.systemDefault());
        } catch (IOException e) {
            return LocalDateTime.now();
        }
    }

    private Long probeDurationMs(Path path) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    path.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            String output;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                output = reader.readLine();
            }
            int exitCode = process.waitFor();
            if (exitCode != 0 || output == null || output.isBlank()) return null;
            double seconds = Double.parseDouble(output.trim());
            return Math.round(seconds * 1000);
        } catch (Exception e) {
            log.warn("[IMPORT] ffprobe indisponible ou échec pour {}: {}", path.getFileName(), e.getMessage());
            return null;
        }
    }
}
