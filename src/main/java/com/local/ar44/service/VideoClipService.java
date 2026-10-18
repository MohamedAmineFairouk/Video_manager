package com.local.ar44.service;

import com.local.ar44.dto.Video;
import com.local.ar44.dto.VideoAnchor;
import com.local.ar44.dto.VideoWatchLog;
import com.local.ar44.repo.VideoAnchorRepository;
import com.local.ar44.repo.VideoRepository;
import com.local.ar44.repo.VideoWatchLogRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Crée une nouvelle vidéo à partir de segments choisis d'une vidéo existante
 * (éditeur "✂ Découper" du lecteur).
 *
 * Les fichiers étant brouillés sur disque (FileObfuscationService), la source est
 * d'abord restaurée dans un fichier temporaire, ffmpeg extrait puis concatène les
 * segments (réencodage H.264/AAC pour des coupes précises), la miniature et le
 * storyboard sont générés depuis le résultat, puis tout est brouillé à son
 * emplacement définitif. La nouvelle vidéo reprend les métadonnées de l'originale
 * (créateurs, tags, niveau, favori, commentaire, historique de vues) ; les ancres
 * comprises dans les segments sont recalées sur la nouvelle timeline.
 *
 * Le traitement peut durer plusieurs minutes : il tourne en tâche de fond, une vidéo à
 * la fois (les demandes suivantes attendent leur tour), et le front suit l'avancement
 * via {@link #listJobs()} sans bloquer l'application.
 */
@Service
public class VideoClipService {

    private static final Logger log = LoggerFactory.getLogger(VideoClipService.class);

    public record Segment(double start, double end) {
        double duration() { return end - start; }
    }

    public static class ClipJob {
        public final String id;
        public final Long sourceVideoId;
        public final String title;
        public final long createdAt = System.currentTimeMillis();
        public volatile long finishedAt;
        public volatile String status = "pending"; // pending | running | done | error
        public volatile double progress = 0;      // 0..1
        public volatile Long newVideoId;
        public volatile String error;

        ClipJob(String id, Long sourceVideoId, String title) {
            this.id = id;
            this.sourceVideoId = sourceVideoId;
            this.title = title;
        }

        boolean finished() { return "done".equals(status) || "error".equals(status); }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", id);
            map.put("sourceVideoId", sourceVideoId);
            map.put("title", title);
            map.put("createdAt", createdAt);
            map.put("status", status);
            map.put("progress", progress);
            map.put("newVideoId", newVideoId);
            map.put("error", error);
            return map;
        }
    }

    private final VideoRepository videoRepository;
    private final VideoAnchorRepository videoAnchorRepository;
    private final VideoWatchLogRepository videoWatchLogRepository;
    private final ThumbnailStorageService thumbnailStorageService;
    private final FileObfuscationService fileObfuscationService;
    private final Path videosDir;
    private final int thumbWidth;
    private final TransactionTemplate transactionTemplate;

    private final Map<String, ClipJob> jobs = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "video-clip");
        t.setDaemon(true);
        return t;
    });

    public VideoClipService(VideoRepository videoRepository,
                            VideoAnchorRepository videoAnchorRepository,
                            VideoWatchLogRepository videoWatchLogRepository,
                            ThumbnailStorageService thumbnailStorageService,
                            FileObfuscationService fileObfuscationService,
                            @Value("${app.videos.dir}") String videosDir,
                            @Value("${thumbnail.width:180}") int thumbWidth,
                            PlatformTransactionManager transactionManager) {
        this.videoRepository = videoRepository;
        this.videoAnchorRepository = videoAnchorRepository;
        this.videoWatchLogRepository = videoWatchLogRepository;
        this.thumbnailStorageService = thumbnailStorageService;
        this.fileObfuscationService = fileObfuscationService;
        this.videosDir = Paths.get(videosDir);
        this.thumbWidth = thumbWidth;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public ClipJob getJob(String jobId) {
        return jobs.get(jobId);
    }

    /** Tâches en attente / en cours, et celles terminées depuis moins d'une heure (les plus anciennes d'abord). */
    public List<ClipJob> listJobs() {
        long expiry = System.currentTimeMillis() - 60 * 60 * 1000L;
        jobs.values().removeIf(j -> j.finished() && j.finishedAt < expiry);
        List<ClipJob> list = new ArrayList<>(jobs.values());
        list.sort((a, b) -> Long.compare(a.createdAt, b.createdAt));
        return list;
    }

    /** Valide la demande puis lance le traitement en tâche de fond. */
    public ClipJob start(Long sourceVideoId, List<Segment> rawSegments, String title, double rawVolume) {
        Video source = videoRepository.findById(sourceVideoId)
                .orElseThrow(() -> new IllegalArgumentException("Vidéo introuvable"));
        if (source.getFileName() == null || source.getFileName().isBlank()) {
            throw new IllegalArgumentException("La vidéo n'a pas de fichier associé");
        }
        double maxSeconds = source.getDurationMs() != null ? source.getDurationMs() / 1000.0 : Double.MAX_VALUE;
        double volume = Double.isFinite(rawVolume) ? Math.max(0.1, Math.min(4.0, rawVolume)) : 1.0;
        // Aucun segment mais un volume modifié : toute la vidéo est reprise avec le nouveau son.
        if ((rawSegments == null || rawSegments.isEmpty()) && Math.abs(volume - 1.0) > 0.005 && source.getDurationMs() != null) {
            rawSegments = List.of(new Segment(0, maxSeconds));
        }
        List<Segment> segments = normalize(rawSegments, maxSeconds);
        if (segments.isEmpty()) {
            throw new IllegalArgumentException("Aucun segment valide (au moins 0,5 s chacun)");
        }

        String finalTitle = title == null || title.isBlank() ? source.getTitle() + "_extrait" : title.trim();
        ClipJob job = new ClipJob(UUID.randomUUID().toString(), sourceVideoId, finalTitle);
        jobs.put(job.id, job);
        executor.submit(() -> run(job, sourceVideoId, segments, finalTitle, volume));
        return job;
    }

    /** Trie, borne à la durée de la vidéo, fusionne les chevauchements et écarte les segments trop courts. */
    private List<Segment> normalize(List<Segment> raw, double maxSeconds) {
        List<Segment> sorted = new ArrayList<>();
        if (raw == null) return sorted;
        for (Segment s : raw) {
            double start = Math.max(0, s.start());
            double end = Math.min(maxSeconds, s.end());
            if (end - start >= 0.5) sorted.add(new Segment(start, end));
        }
        sorted.sort((a, b) -> Double.compare(a.start(), b.start()));
        List<Segment> merged = new ArrayList<>();
        for (Segment s : sorted) {
            if (!merged.isEmpty() && s.start() <= merged.get(merged.size() - 1).end()) {
                Segment last = merged.remove(merged.size() - 1);
                merged.add(new Segment(last.start(), Math.max(last.end(), s.end())));
            } else {
                merged.add(s);
            }
        }
        return merged;
    }

    private void run(ClipJob job, Long sourceVideoId, List<Segment> segments, String title, double volume) {
        job.status = "running";
        Path tempSource = null;
        Path tempOutput = null;
        Path tempThumb = null;
        Path tempStoryboard = null;
        Path finalVideo = null;
        try {
            Video source = videoRepository.findById(sourceVideoId).orElseThrow();
            Path sourcePath = videosDir.resolve(source.getFileName()).toAbsolutePath();
            if (!Files.exists(sourcePath)) throw new IllegalStateException("Fichier source introuvable");

            // 0 → 10 % : restauration du fichier source en clair
            tempSource = Files.createTempFile(videosDir, "clip-src-", ".mp4");
            transformFile(sourcePath, tempSource);
            job.progress = 0.10;

            // 10 → 90 % : découpe + concaténation
            tempOutput = Files.createTempFile(videosDir, "clip-out-", ".mp4");
            boolean hasAudio = hasAudioStream(tempSource);
            double totalSeconds = segments.stream().mapToDouble(Segment::duration).sum();
            runFfmpegCut(job, tempSource, tempOutput, segments, hasAudio, totalSeconds, volume);
            deleteQuietly(tempSource);
            tempSource = null;

            long durationMs = Math.round(totalSeconds * 1000);

            // 90 → 97 % : miniature + storyboard
            tempThumb = Files.createTempFile(videosDir, "clip-thumb-", ".jpg");
            boolean thumbOk = generateThumbnail(tempOutput, tempThumb, durationMs);
            tempStoryboard = Files.createTempFile(videosDir, "clip-sb-", ".jpg");
            boolean storyboardOk = generateStoryboard(tempOutput, tempStoryboard, durationMs);
            job.progress = 0.97;

            // Fichier définitif brouillé, nom interne aléatoire (comme ingest_videos.py)
            String fileName;
            do {
                fileName = UUID.randomUUID().toString().replace("-", "") + "." + FileObfuscationService.VIDEO_EXTENSION;
            } while (Files.exists(videosDir.resolve(fileName)));
            finalVideo = videosDir.resolve(fileName);
            transformFile(tempOutput, finalVideo);

            // Source rechargée dans la transaction : ses tags/créateurs y sont gérés par JPA
            // (sinon la cascade PERSIST des tags échoue sur des entités détachées).
            String storedName = fileName;
            Video created = transactionTemplate.execute(status -> {
                Video managedSource = videoRepository.findById(sourceVideoId).orElseThrow();
                Video saved = videoRepository.save(copyMetadata(managedSource, title, storedName, durationMs));
                copyWatchLogs(managedSource.getId(), saved.getId());
                copyAnchors(managedSource, saved, segments);
                return saved;
            });

            if (thumbOk) {
                Files.write(thumbnailStorageService.getThumbPath(fileName),
                        fileObfuscationService.transform(Files.readAllBytes(tempThumb)));
            }
            if (storyboardOk) {
                Files.write(thumbnailStorageService.getStoryboardPath(created.getId()),
                        fileObfuscationService.transform(Files.readAllBytes(tempStoryboard)));
            }

            finalVideo = null; // conservé : la vidéo est enregistrée
            job.newVideoId = created.getId();
            job.progress = 1;
            job.status = "done";
            log.warn("[CLIP] Vidéo {} créée depuis {} ({} segment(s), {} s)", created.getId(), source.getId(), segments.size(), Math.round(totalSeconds));
        } catch (Exception e) {
            log.error("[CLIP] Échec de la création depuis la vidéo {}: {}", sourceVideoId, e.getMessage());
            job.error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            job.status = "error";
        } finally {
            job.finishedAt = System.currentTimeMillis();
            deleteQuietly(tempSource);
            deleteQuietly(tempOutput);
            deleteQuietly(tempThumb);
            deleteQuietly(tempStoryboard);
            deleteQuietly(finalVideo);
        }
    }

    private Video copyMetadata(Video source, String title, String fileName, long durationMs) {
        Video v = new Video();
        v.setTitle(title);
        v.setFileName(fileName);
        v.setDurationMs(durationMs);
        v.setCreators(new HashSet<>(source.getCreators()));
        v.setTags(new HashSet<>(source.getTags()));
        v.setSourceIndex(source.getSourceIndex());
        v.setComment(source.getComment());
        v.setFavorite(Boolean.TRUE.equals(source.getFavorite()));
        v.setFavoriteAt(Boolean.TRUE.equals(source.getFavorite()) ? LocalDateTime.now() : null);
        v.setArchived(false);
        v.setLastWatchedAt(source.getLastWatchedAt());
        v.setCreatedAt(LocalDateTime.now());
        return v;
    }

    // Le nombre de vues est calculé depuis video_watch_log : on duplique l'historique.
    private void copyWatchLogs(Long sourceId, Long targetId) {
        List<VideoWatchLog> copies = new ArrayList<>();
        for (VideoWatchLog log : videoWatchLogRepository.findByVideoId(sourceId)) {
            VideoWatchLog copy = new VideoWatchLog();
            copy.setVideoId(targetId);
            copy.setPage(log.getPage());
            copy.setUsername(log.getUsername());
            copy.setWatchedSeconds(log.getWatchedSeconds());
            copy.setWatchedAt(log.getWatchedAt());
            copies.add(copy);
        }
        videoWatchLogRepository.saveAll(copies);
    }

    // Ancres comprises dans un segment, recalées sur la timeline de la nouvelle vidéo.
    private void copyAnchors(Video source, Video target, List<Segment> segments) {
        List<VideoAnchor> copies = new ArrayList<>();
        for (VideoAnchor anchor : videoAnchorRepository.findByVideoIdOrderBySecondsAsc(source.getId())) {
            double offset = 0;
            for (Segment s : segments) {
                if (anchor.getSeconds() >= s.start() && anchor.getSeconds() < s.end()) {
                    VideoAnchor copy = new VideoAnchor();
                    copy.setVideo(target);
                    copy.setSeconds((int) Math.floor(offset + anchor.getSeconds() - s.start()));
                    copy.setCreatedAt(LocalDateTime.now());
                    copies.add(copy);
                    break;
                }
                offset += s.duration();
            }
        }
        videoAnchorRepository.saveAll(copies);
    }

    private void runFfmpegCut(ClipJob job, Path input, Path output, List<Segment> segments,
                              boolean hasAudio, double totalSeconds, double volume) throws Exception {
        List<String> cmd = new ArrayList<>(List.of("ffmpeg", "-y", "-hide_banner", "-nostats"));
        // Une entrée par segment avec -ss/-t avant -i : saut rapide dans les longues vidéos.
        for (Segment s : segments) {
            cmd.addAll(List.of(
                    "-ss", String.format(Locale.ROOT, "%.3f", s.start()),
                    "-t", String.format(Locale.ROOT, "%.3f", s.duration()),
                    "-i", input.toString()));
        }
        StringBuilder filter = new StringBuilder();
        for (int i = 0; i < segments.size(); i++) {
            filter.append('[').append(i).append(":v:0]");
            if (hasAudio) filter.append('[').append(i).append(":a:0]");
        }
        filter.append("concat=n=").append(segments.size())
                .append(":v=1:a=").append(hasAudio ? 1 : 0)
                .append("[v]").append(hasAudio ? "[a]" : "");
        // Réglage du son (1.0 = inchangé), appliqué après l'assemblage des segments.
        String audioLabel = "[a]";
        if (hasAudio && Math.abs(volume - 1.0) > 0.005) {
            filter.append(String.format(Locale.ROOT, ";[a]volume=%.3f:precision=float[aout]", volume));
            audioLabel = "[aout]";
        }
        cmd.addAll(List.of("-filter_complex", filter.toString(), "-map", "[v]"));
        if (hasAudio) cmd.addAll(List.of("-map", audioLabel, "-c:a", "aac", "-b:a", "160k"));
        cmd.addAll(List.of(
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                "-progress", "pipe:1",
                output.toString()));

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process process = pb.start();
        StringBuilder tail = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("out_time_us=") || line.startsWith("out_time_ms=")) {
                    try {
                        double seconds = Long.parseLong(line.substring(line.indexOf('=') + 1).trim()) / 1_000_000.0;
                        double ratio = totalSeconds > 0 ? Math.min(1, seconds / totalSeconds) : 0;
                        job.progress = 0.10 + 0.80 * ratio;
                    } catch (NumberFormatException ignored) {
                        // "N/A" au tout début
                    }
                } else if (!line.contains("=")) {
                    tail.append(line).append('\n');
                    if (tail.length() > 4000) tail.delete(0, tail.length() - 4000);
                }
            }
        }
        int exit = process.waitFor();
        if (exit != 0 || !Files.exists(output) || Files.size(output) == 0) {
            log.error("[CLIP] ffmpeg a échoué (code {}):\n{}", exit, tail);
            throw new IllegalStateException("ffmpeg a échoué (code " + exit + ")");
        }
        job.progress = 0.90;
    }

    private boolean hasAudioStream(Path file) {
        try {
            Process p = new ProcessBuilder("ffprobe", "-v", "error", "-select_streams", "a",
                    "-show_entries", "stream=index", "-of", "csv=p=0", file.toString())
                    .redirectErrorStream(true).start();
            String out;
            try (InputStream in = p.getInputStream()) {
                out = new String(in.readAllBytes(), StandardCharsets.UTF_8).trim();
            }
            return p.waitFor() == 0 && !out.isEmpty();
        } catch (Exception e) {
            return true;
        }
    }

    private boolean generateThumbnail(Path video, Path out, long durationMs) {
        String seek = durationMs < 10 * 60 * 1000L ? (durationMs > 6000 ? "3" : "0") : "35";
        return runQuietly(List.of("ffmpeg", "-y", "-ss", seek, "-i", video.toString(),
                "-frames:v", "1", "-vf", "scale=" + thumbWidth + ":-1", "-q:v", "4", out.toString()), out);
    }

    private boolean generateStoryboard(Path video, Path out, long durationMs) {
        if (durationMs <= 0) return false;
        double fps = StoryboardService.FRAME_COUNT / (durationMs / 1000.0);
        return runQuietly(List.of("ffmpeg", "-y", "-i", video.toString(),
                "-vf", String.format(Locale.ROOT, "fps=%f,scale=%d:%d,tile=%dx%d", fps,
                        StoryboardService.TILE_WIDTH, StoryboardService.TILE_HEIGHT,
                        StoryboardService.COLS, StoryboardService.ROWS),
                "-frames:v", "1", "-update", "1", "-q:v", "4", out.toString()), out);
    }

    private boolean runQuietly(List<String> cmd, Path expectedOutput) {
        try {
            Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            try (InputStream in = p.getInputStream()) {
                in.readAllBytes();
            }
            return p.waitFor() == 0 && Files.exists(expectedOutput) && Files.size(expectedOutput) > 0;
        } catch (Exception e) {
            log.warn("[CLIP] {} a échoué: {}", cmd.get(0), e.getMessage());
            return false;
        }
    }

    /** Brouille ou restaure un fichier (XOR symétrique), par blocs. */
    private void transformFile(Path src, Path dest) throws Exception {
        try (InputStream in = Files.newInputStream(src); OutputStream out = Files.newOutputStream(dest)) {
            byte[] buffer = new byte[1024 * 1024];
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
}
