package com.local.ar44.controller;

import com.local.ar44.dto.AppConfig;
import com.local.ar44.dto.UpdateVideoRequest;
import com.local.ar44.dto.Creator;
import com.local.ar44.dto.Tag;
import com.local.ar44.dto.Video;
import com.local.ar44.dto.VideoResponse;
import com.local.ar44.repo.AppConfigRepository;
import com.local.ar44.repo.PlaylistItemRepository;
import com.local.ar44.repo.TagRepository;
import com.local.ar44.repo.VideoAnchorRepository;
import com.local.ar44.repo.VideoRepository;
import com.local.ar44.repo.VideoWatchLogRepository;
import com.local.ar44.service.StatsService;
import com.local.ar44.service.ThumbnailStorageService;
import com.local.ar44.service.VideoResponseMapper;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/videos")
public class VideoController {
    @Value("${app.videos.dir}")
    private String videosDir;
    private static final Logger log = LoggerFactory.getLogger(VideoController.class);

    private final VideoRepository videoRepository;
    private final AppConfigRepository appConfigRepository;
    private final TagRepository tagRepository;
    private final com.local.ar44.service.CreatorService creatorService;
    private final StatsService statsService;
    private final ThumbnailStorageService thumbnailStorageService;
    private final VideoResponseMapper videoResponseMapper;
    private final com.local.ar44.service.VideoImportService videoImportService;
    private final com.local.ar44.service.StoryboardService storyboardService;
    private final com.local.ar44.service.FileObfuscationService fileObfuscationService;
    private final com.local.ar44.service.ObfuscationMigrationService obfuscationMigrationService;
    private final VideoAnchorRepository videoAnchorRepository;
    private final PlaylistItemRepository playlistItemRepository;
    private final VideoWatchLogRepository videoWatchLogRepository;

    public VideoController(VideoRepository videoRepository,
                           AppConfigRepository appConfigRepository,
                           TagRepository tagRepository,
                           StatsService statsService,
                           ThumbnailStorageService thumbnailStorageService,
                           com.local.ar44.service.CreatorService creatorService,
                           VideoResponseMapper videoResponseMapper,
                           com.local.ar44.service.VideoImportService videoImportService,
                           com.local.ar44.service.StoryboardService storyboardService,
                           com.local.ar44.service.FileObfuscationService fileObfuscationService,
                           com.local.ar44.service.ObfuscationMigrationService obfuscationMigrationService,
                           VideoAnchorRepository videoAnchorRepository,
                           PlaylistItemRepository playlistItemRepository,
                           VideoWatchLogRepository videoWatchLogRepository) {
        this.videoRepository = videoRepository;
        this.appConfigRepository = appConfigRepository;
        this.tagRepository = tagRepository;
        this.statsService = statsService;
        this.thumbnailStorageService = thumbnailStorageService;
        this.creatorService = creatorService;
        this.videoResponseMapper = videoResponseMapper;
        this.videoImportService = videoImportService;
        this.storyboardService = storyboardService;
        this.fileObfuscationService = fileObfuscationService;
        this.obfuscationMigrationService = obfuscationMigrationService;
        this.videoAnchorRepository = videoAnchorRepository;
        this.playlistItemRepository = playlistItemRepository;
        this.videoWatchLogRepository = videoWatchLogRepository;
    }

    private Tag findOrCreateTag(String name) {
        return tagRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> tagRepository.save(new Tag(name)));
    }

    private void assignTagsToVideo(Video video, List<String> tagNames) {
        video.getTags().clear();
        if (tagNames == null) return;
        for (String name : tagNames) {
            if (name == null) continue;
            String trimmed = name.trim();
            if (trimmed.isEmpty()) continue;
            video.getTags().add(findOrCreateTag(trimmed));
        }
    }

    // ========================
    // 🔹 HOST MANAGEMENT
    // ========================
    private String resolveHost(HttpSession session) {
        String host = (String) session.getAttribute("mediaHost");

        if (host == null || host.isEmpty()) {
            host = appConfigRepository.findAll()
                    .stream()
                    .findFirst()
                    .map(AppConfig::getMediaHost)
                    .orElse("192.168.1.30");

            session.setAttribute("mediaHost", host);
        }
        return host;
    }

    private static final java.util.concurrent.atomic.AtomicLong STREAM_REQUEST_SEQ = new java.util.concurrent.atomic.AtomicLong();

    @GetMapping("/file")
    public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody> getVideoFile(
            @RequestParam String fileName,
            @RequestHeader(value = "Range", required = false) String rangeHeader) throws java.io.IOException {
        long reqId = STREAM_REQUEST_SEQ.incrementAndGet();
        Path videoPath = Paths.get(videosDir, fileName).toAbsolutePath();
        log.debug("[STREAM #{}] Demande de lecture pour {} (Range='{}')", reqId, videoPath, rangeHeader);
        if (!Files.exists(videoPath)) {
            log.error("[STREAM #{}] Fichier vidéo introuvable: {}", reqId, videoPath);
            return ResponseEntity.notFound().build();
        }

        long fileSize = Files.size(videoPath);
        long start = 0;
        long end = fileSize - 1;

        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            String[] parts = rangeHeader.substring(6).split("-");
            try {
                if (!parts[0].isBlank()) start = Long.parseLong(parts[0]);
                if (parts.length > 1 && !parts[1].isBlank()) end = Long.parseLong(parts[1]);
            } catch (NumberFormatException ignored) {
                // fall back to serving the whole file
            }
        }
        end = Math.min(end, fileSize - 1);
        if (start > end) start = end;
        long contentLength = end - start + 1;
        long rangeStart = start;
        long rangeEnd = end;

        log.debug("[STREAM #{}] fileSize={} start={} end={} contentLength={} ({} MiB)",
                reqId, fileSize, rangeStart, rangeEnd, contentLength, contentLength / (1024.0 * 1024.0));

        org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody body = outputStream -> {
            long streamStartNanos = System.nanoTime();
            long totalToSend = rangeEnd - rangeStart + 1;
            long pos = rangeStart;
            try (java.io.RandomAccessFile raf = new java.io.RandomAccessFile(videoPath.toFile(), "r")) {
                raf.seek(rangeStart);
                byte[] buffer = new byte[64 * 1024];
                long remaining = totalToSend;
                while (remaining > 0) {
                    int toRead = (int) Math.min(buffer.length, remaining);
                    int read = raf.read(buffer, 0, toRead);
                    if (read == -1) {
                        log.warn("[STREAM #{}] EOF disque inattendu à pos={} (reçu {} / attendu {} octets)",
                                reqId, pos, pos - rangeStart, totalToSend);
                        break;
                    }
                    fileObfuscationService.transform(buffer, 0, read, pos);
                    outputStream.write(buffer, 0, read);
                    pos += read;
                    remaining -= read;
                }
            } catch (java.io.IOException e) {
                double totalElapsedSec = (System.nanoTime() - streamStartNanos) / 1_000_000_000.0;
                // The player opens/cancels several probing Range requests within the first
                // second on every load (normal MP4 metadata discovery) - only log cutoffs
                // that happened well into an established stream, since those are the real
                // problem cases (e.g. the async request timeout that used to fire at ~30s).
                if (totalElapsedSec > 2.0) {
                    log.warn("[STREAM #{}] interrompu après {} / {} octets en {}s: {}",
                            reqId, pos - rangeStart, totalToSend, String.format("%.2f", totalElapsedSec), e.toString());
                }
                throw e;
            }
        };

        boolean partial = rangeHeader != null;
        ResponseEntity.BodyBuilder builder = ResponseEntity
                .status(partial ? org.springframework.http.HttpStatus.PARTIAL_CONTENT : org.springframework.http.HttpStatus.OK)
                .header("Content-Type", "video/mp4")
                .header("Accept-Ranges", "bytes")
                .header("Content-Length", String.valueOf(contentLength));
        if (partial) {
            builder.header("Content-Range", "bytes " + rangeStart + "-" + rangeEnd + "/" + fileSize);
        }
        return builder.body(body);
    }

    // ========================
    // 🎬 GET ALL VIDEOS
    // ========================
    @GetMapping
    public List<VideoResponse> getVideos(HttpSession session) {
        resolveHost(session);
        return videoRepository.findAll()
                .stream()
                .map(videoResponseMapper::toResponse)
                .toList();
    }

    // ========================
    // 🕒 RECENTLY WATCHED
    // ========================
    @GetMapping("/recently-watched")
    public List<VideoResponse> getRecentlyWatched(HttpSession session) {
        resolveHost(session);
        return videoRepository.findAll()
                .stream()
                .filter(video -> video.getLastWatchedAt() != null)
                .sorted(Comparator.comparing(Video::getLastWatchedAt).reversed())
                .limit(20)
                .map(videoResponseMapper::toResponse)
                .toList();
    }

    @GetMapping("/by-creator")
    public List<VideoResponse> getByCreator(@RequestParam String creator, HttpSession session) {
        // TODO: Adapter la recherche par creator (ManyToMany)
        return List.of();
    }

    // ========================
    // ✨ DÉCOUVERTE ALÉATOIRE
    // ========================
    // Critères : ni archivée, ni déjà dans une playlist, un "CI" (sourceIndex) parmi les 3
    // meilleurs (1 = le plus élevé), puis priorité aux moins vues. Le tirage se fait ensuite au
    // hasard dans ce sous-ensemble déjà trié, pour garder un effet "découverte" tout en
    // respectant ces critères.
    @GetMapping("/discover")
    public List<VideoResponse> discover(@RequestParam(defaultValue = "18") int limit, HttpSession session) {
        resolveHost(session);
        Set<Long> inPlaylist = new HashSet<>(playlistItemRepository.findDistinctVideoIds());

        List<VideoResponse> ranked = videoRepository.findAll().stream()
                .filter(v -> !Boolean.TRUE.equals(v.getArchived()))
                .filter(v -> !inPlaylist.contains(v.getId()))
                .filter(v -> v.getSourceIndex() != null && v.getSourceIndex() >= 1 && v.getSourceIndex() <= 3)
                .map(videoResponseMapper::toResponse)
                .sorted(Comparator.comparing(VideoResponse::getSourceIndex)
                        .thenComparing(VideoResponse::getViewCount))
                .toList();

        int poolSize = Math.min(ranked.size(), Math.max(limit * 3, 40));
        List<VideoResponse> pool = new ArrayList<>(ranked.subList(0, poolSize));
        Collections.shuffle(pool);
        return pool.stream().limit(limit).toList();
    }

    @GetMapping("/search")
    public List<VideoResponse> search(@RequestParam String q, HttpSession session) {
        resolveHost(session);
        String needle = q.toLowerCase();
        // Le titre est obfusqué en base (TitleObfuscationConverter) : impossible de faire un
        // LIKE SQL dessus, on filtre donc en mémoire sur la valeur décodée par l'entité.
        return videoRepository.findAll()
                .stream()
                .filter(v -> v.getTitle() != null && v.getTitle().toLowerCase().contains(needle))
                .map(videoResponseMapper::toResponse)
                .toList();
    }

    // ========================
    // 📊 META DATA
    // ========================

    @GetMapping("/creators")
    public List<String> getCreators() {
        return creatorService.findAll().stream()
                .map(Creator::getName)
                .filter(n -> n != null && !n.isBlank())
                .sorted()
                .toList();
    }

    @PostMapping("/creators")
    public ResponseEntity<String> addCreator(@RequestParam String name) {
        String cleaned = name == null ? "" : name.trim();
        if (cleaned.isEmpty()) {
            return ResponseEntity.badRequest().body("Nom du créateur requis");
        }
        if (creatorService.findByName(cleaned).isPresent()) {
            return ResponseEntity.badRequest().body("Ce créateur existe déjà");
        }

        creatorService.save(new Creator(cleaned));
        return ResponseEntity.ok(cleaned);
    }

    @GetMapping("/creators/detailed")
    public List<com.local.ar44.dto.CreatorResponse> getCreatorsDetailed() {
        return creatorService.findAll().stream()
                .map(c -> new com.local.ar44.dto.CreatorResponse(c.getId(), c.getName()))
                .sorted(java.util.Comparator.comparing(com.local.ar44.dto.CreatorResponse::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @DeleteMapping("/creators/{id}")
    public ResponseEntity<Void> deleteCreator(@PathVariable Long id) {
        creatorService.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/tags")
    public List<String> getTags() {
        return tagRepository.findDistinctTagNames();
    }

    @PostMapping("/tags")
    public ResponseEntity<String> addTag(@RequestParam String name) {
        String cleaned = name == null ? "" : name.trim();
        if (cleaned.isEmpty()) {
            return ResponseEntity.badRequest().body("Nom du tag requis");
        }
        if (tagRepository.findByNameIgnoreCase(cleaned).isPresent()) {
            return ResponseEntity.badRequest().body("Ce tag existe déjà");
        }
        tagRepository.save(new Tag(cleaned));
        return ResponseEntity.ok(cleaned);
    }

    @GetMapping("/tags/detailed")
    public List<com.local.ar44.dto.TagResponse> getTagsDetailed() {
        return tagRepository.findAll().stream()
                .map(t -> new com.local.ar44.dto.TagResponse(t.getId(), t.getName()))
                .sorted(java.util.Comparator.comparing(com.local.ar44.dto.TagResponse::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional
    @DeleteMapping("/tags/{id}")
    public ResponseEntity<Void> deleteTag(@PathVariable Long id) {
        List<Video> affected = videoRepository.findAll().stream()
                .filter(v -> v.getTags() != null && v.getTags().stream().anyMatch(t -> t.getId().equals(id)))
                .toList();
        for (Video v : affected) {
            v.getTags().removeIf(t -> t.getId().equals(id));
        }
        videoRepository.saveAll(affected);
        tagRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @Transactional
    @PostMapping("/tags/clear-assignments")
    public ResponseEntity<Map<String, Object>> clearTagAssignments() {
        List<Video> affected = videoRepository.findAll().stream()
                .filter(v -> v.getTags() != null && !v.getTags().isEmpty())
                .toList();
        for (Video v : affected) {
            v.getTags().clear();
        }
        videoRepository.saveAll(affected);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("videosUpdated", affected.size());
        return ResponseEntity.ok(result);
    }

    // ========================
    // ➕ CREATE VIDEO
    // ========================
    @GetMapping("/create")
    public Video createVideo(
            @RequestParam String fileName,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String creator,
            @RequestParam(required = false) Long duration
    ) {
        Video v = new Video();
        v.setFileName(fileName);
        v.setTitle(title != null ? title : fileName);
        v.setDurationMs(duration);

        return videoRepository.save(v);
    }

    // ========================
    // ✏️ UPDATE VIDEO
    // ========================
    @GetMapping("/update")
    public VideoResponse updateVideo(
            @RequestParam Long id,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String creator,
            @RequestParam(required = false) Integer sourceIndex,
            HttpSession session
    ) {
        Video v = videoRepository.findById(id).orElseThrow();

        if (title != null) v.setTitle(title);
        if (sourceIndex != null) {
            int requested = Math.max(0, Math.min(5, sourceIndex));
            v.setSourceIndex(requested);
        }

        Video saved = videoRepository.save(v);
        resolveHost(session);
        return videoResponseMapper.toResponse(saved);
    }

    // New RESTful update using JSON body
    @PutMapping("/{id}")
    public VideoResponse updateVideoPut(@PathVariable Long id, @RequestBody UpdateVideoRequest req, HttpSession session) {
        Video v = videoRepository.findById(id).orElseThrow();

        if (req.getTitle() != null) v.setTitle(req.getTitle());
        // Gestion creators par IDs (héritage)
        if (req.getCreatorIds() != null) {
            Set<com.local.ar44.dto.Creator> creators = new HashSet<>();
            for (Long creatorId : req.getCreatorIds()) {
                creatorService.findById(creatorId).ifPresent(creators::add);
            }
            v.setCreators(creators);
        }
        // Gestion creators par noms (nouvelle UI avancée)
        if (req.getCreatorNames() != null) {
            Set<com.local.ar44.dto.Creator> creators = new HashSet<>();
            for (String name : req.getCreatorNames()) {
                creatorService.findByName(name).ifPresent(creators::add);
            }
            v.setCreators(creators);
        }
        if (req.getSourceIndex() != null) {
            int requested = Math.max(0, Math.min(5, req.getSourceIndex()));
            v.setSourceIndex(requested);
        }
        if (req.getTags() != null) {
            assignTagsToVideo(v, req.getTags());
        }
        if (req.getComment() != null) v.setComment(req.getComment());

        Video saved = videoRepository.save(v);
        resolveHost(session);
        return videoResponseMapper.toResponse(saved);
    }

    // ========================
    // ❌ DELETE VIDEO
    // ========================
    private static final String TRASH_DIR_NAME = "a_supprimer";

    // Dossier "à supprimer" à côté du jar (run.bat s'y place avant de lancer le jar, donc
    // user.dir pointe déjà vers ce répertoire). Les fichiers y sont déplacés plutôt que
    // supprimés définitivement : c'est à l'utilisateur de les nettoyer manuellement ensuite.
    private Path resolveTrashDir() throws java.io.IOException {
        Path trashDir = Paths.get(System.getProperty("user.dir"), TRASH_DIR_NAME);
        Files.createDirectories(trashDir);
        return trashDir;
    }

    // Déplace un fichier existant vers la corbeille en préfixant son nom par l'id de la vidéo
    // (évite toute collision et permet à l'utilisateur de retrouver facilement à quelle vidéo
    // appartenait chaque fichier). Ne touche à aucun autre fichier du dossier.
    //
    // Réessaie plusieurs fois : sous Windows, le fichier vidéo peut encore être verrouillé
    // juste après l'arrêt de la lecture (le flux /api/videos/file vient de se fermer côté
    // client mais le handle côté serveur n'est pas encore totalement relâché).
    private void moveToTrash(Path source, Path trashDir, Long videoId, String label) {
        if (source == null) return;
        if (!Files.exists(source) || !Files.isRegularFile(source)) {
            log.warn("[DELETE] {} introuvable, rien à déplacer: {}", label, source);
            return;
        }
        Path target = trashDir.resolve(videoId + "_" + source.getFileName());
        int maxAttempts = 5;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                Files.move(source, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                log.info("[DELETE] {} déplacé vers la corbeille: {}", label, target);
                return;
            } catch (java.nio.file.FileSystemException e) {
                if (attempt == maxAttempts) {
                    log.error("[DELETE] Erreur déplacement {} vers la corbeille (fichier verrouillé après {} essais): {}", label, attempt, e.getMessage());
                    return;
                }
                try {
                    Thread.sleep(400);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            } catch (Exception e) {
                log.error("[DELETE] Erreur déplacement {} vers la corbeille: {}", label, e.getMessage());
                return;
            }
        }
    }

    @Transactional
    @GetMapping("/delete")
    public String deleteVideo(@RequestParam Long id) {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isEmpty()) {
            return "Vidéo introuvable : " + id;
        }
        Video video = videoOpt.get();
        String fileName = video.getFileName();

        // Nettoyage des éléments liés en base avant la vidéo elle-même : sans ça, la suppression
        // échouait (contrainte de clé étrangère) dès qu'une vidéo avait au moins une ancre ou
        // appartenait à une playlist, ce qui laissait le fichier déjà supprimé du disque mais la
        // ligne "video" bloquée en base (vidéo cassée dans l'appli).
        videoAnchorRepository.deleteByVideoId(id);
        playlistItemRepository.deleteByVideoId(id);
        videoWatchLogRepository.deleteByVideoId(id);
        videoRepository.deleteById(id);

        // Déplacement des fichiers (vidéo, thumbnail, storyboard) vers la corbeille plutôt que
        // suppression définitive. Erreurs de fichiers loggées mais non bloquantes : la vidéo est
        // déjà supprimée en base à ce stade.
        try {
            Path trashDir = resolveTrashDir();

            if (fileName != null && !fileName.isBlank()) {
                // Détection du répertoire courant (là où se trouve le JAR)
                String currentDir = System.getProperty("user.dir");
                boolean isLinux = System.getProperty("os.name").toLowerCase().contains("linux");
                Path baseDir = isLinux ? Paths.get(currentDir) : Paths.get(videosDir);
                Path videoPath = baseDir.resolve(fileName).toAbsolutePath();
                moveToTrash(videoPath, trashDir, id, "Fichier vidéo");

                // Le thumbnail vit dans son propre dossier configuré (app.thumbnails.dir), pas
                // dans celui des vidéos : c'est pour ça qu'il n'était en réalité jamais supprimé
                // auparavant (mauvais chemin recherché).
                Path thumbPath = thumbnailStorageService.getThumbPath(fileName);
                moveToTrash(thumbPath, trashDir, id, "Thumbnail");
            }

            Path storyboardPath = thumbnailStorageService.getStoryboardPath(id);
            moveToTrash(storyboardPath, trashDir, id, "Storyboard");
        } catch (Exception e) {
            log.error("[DELETE] Erreur lors du déplacement des fichiers vers la corbeille: {}", e.getMessage());
        }

        return "Vidéo supprimée : " + id;
    }

    @GetMapping("/source-index/increase")
    public String increaseSourceIndex(@RequestParam Long id) {
        Video v = videoRepository.findById(id).orElseThrow();

        Integer current = v.getSourceIndex();
        if (current == null) current = 0;
        if (current < 5) {
            v.setSourceIndex(current + 1);
            videoRepository.save(v);
        }
        return "SourceIndex augmenté";
    }

    @GetMapping("/source-index/set")
    public String setSourceIndex(@RequestParam Long id, @RequestParam Integer sourceIndex) {
        Video v = videoRepository.findById(id).orElseThrow();

        if (sourceIndex == null) {
            throw new IllegalArgumentException("sourceIndex is required");
        }

        int requested = Math.max(0, Math.min(5, sourceIndex));
        v.setSourceIndex(requested);
        videoRepository.save(v);

        return "SourceIndex réglé";
    }

    @GetMapping("/source-index/decrease")
    public String decreaseSourceIndex(@RequestParam Long id) {
        Video v = videoRepository.findById(id).orElseThrow();

        Integer current = v.getSourceIndex();
        if (current == null) current = 0;

        if (current > 0) {
            v.setSourceIndex(current - 1);
        }

        videoRepository.save(v);
        return "SourceIndex diminué";
    }


    @GetMapping("/thumbnail")
    public ResponseEntity<byte[]> getThumbnail(@RequestParam Long id) throws java.io.IOException {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video introuvable"));

        Path path = thumbnailStorageService.getThumbPath(video.getFileName());

        if (!Files.exists(path)) {
            log.warn("[THUMBNAIL-MISS] Thumbnail introuvable pour vidéo:");
            log.warn("  - ID: {}", video.getId());
            log.warn("  - FileName: {}", video.getFileName());
            log.warn("  - Title: {}", video.getTitle());
            log.warn("  - Chemin recherché: {}", path.toAbsolutePath());
            return ResponseEntity.notFound().build();
        }

        byte[] bytes = fileObfuscationService.transform(Files.readAllBytes(path));
        return ResponseEntity.ok()
                .header("Content-Type", "image/jpeg")
                .body(bytes);
    }

    @GetMapping("/storyboard")
    public ResponseEntity<byte[]> getStoryboard(@RequestParam Long id) throws java.io.IOException {
        Path path = thumbnailStorageService.getStoryboardPath(id);
        if (!Files.exists(path)) {
            return ResponseEntity.notFound().build();
        }
        byte[] bytes = fileObfuscationService.transform(Files.readAllBytes(path));
        return ResponseEntity.ok()
                .header("Content-Type", "image/jpeg")
                .body(bytes);
    }

    @PostMapping("/storyboards/generate")
    public ResponseEntity<Map<String, Object>> generateStoryboards() {
        return ResponseEntity.ok(storyboardService.generateAll());
    }

    @GetMapping("/favorite/toggle")
    public String toggleFavorite(@RequestParam Long id) {
        Video v = videoRepository.findById(id).orElseThrow();

        boolean nowFav = v.getFavorite() == null || !v.getFavorite();
        v.setFavorite(nowFav);
        if (nowFav) {
            v.setFavoriteAt(LocalDateTime.now());
            // assign an order at the end
            Optional<Video> top = videoRepository.findTopByFavoriteTrueOrderByFavoriteOrderDesc();
            int nextOrder = top.map(tv -> tv.getFavoriteOrder() == null ? 1 : tv.getFavoriteOrder() + 1).orElse(1);
            v.setFavoriteOrder(nextOrder);
        } else {
            v.setFavoriteAt(null);
            v.setFavoriteOrder(null);
        }

        videoRepository.save(v);

        return "OK";
    }

    @GetMapping("/archive/toggle")
    public String toggleArchived(@RequestParam Long id) {
        Video v = videoRepository.findById(id).orElseThrow();

        boolean nowArchived = v.getArchived() == null || !v.getArchived();
        v.setArchived(nowArchived);
        v.setArchivedAt(nowArchived ? LocalDateTime.now() : null);

        videoRepository.save(v);

        return "OK";
    }

    @Transactional
    @PostMapping("/archive/unarchive-all")
    public ResponseEntity<Map<String, Object>> unarchiveAll() {
        List<Video> archived = videoRepository.findByArchivedTrue();
        for (Video v : archived) {
            v.setArchived(false);
            v.setArchivedAt(null);
        }
        videoRepository.saveAll(archived);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("videosUpdated", archived.size());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/watched")
    public ResponseEntity<Void> markWatched(@PathVariable Long id) {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video introuvable"));
        video.setLastWatchedAt(LocalDateTime.now());
        videoRepository.save(video);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/watch-session")
    public ResponseEntity<Void> logWatchSession(@PathVariable Long id,
                                                @RequestParam(required = false) Integer watchedSeconds,
                                                @RequestParam(required = false) String page,
                                                HttpSession session) {
        statsService.logWatchSession(id, page, (String) session.getAttribute("username"), watchedSeconds);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/favorites")
    public List<VideoResponse> getFavorites(HttpSession session) {
        resolveHost(session);
        return videoRepository.findFavoritesOrdered()
                .stream()
                .map(videoResponseMapper::toResponse)
                .toList();
    }

    @PostMapping("/favorites/reorder")
    public String reorderFavorites(@RequestBody List<Long> orderedIds) {
        if (orderedIds == null) {
            throw new IllegalArgumentException("orderedIds is required");
        }

        List<Video> currentFavs = videoRepository.findByFavoriteTrue();
        Set<Long> currentFavIds = currentFavs.stream().map(Video::getId).collect(Collectors.toSet());

        List<Video> toSave = new ArrayList<>();

        int order = 1;
        for (Long id : orderedIds) {
            Video v = videoRepository.findById(id).orElseThrow();
            v.setFavorite(true);
            v.setFavoriteAt(LocalDateTime.now());
            v.setFavoriteOrder(order++);
            toSave.add(v);
            currentFavIds.remove(id);
        }

        // any remaining currently-favorited videos that were not in the new order -> unfavorite
        for (Long remainingId : currentFavIds) {
            Video v = videoRepository.findById(remainingId).orElseThrow();
            v.setFavorite(false);
            v.setFavoriteAt(null);
            v.setFavoriteOrder(null);
            toSave.add(v);
        }

        videoRepository.saveAll(toSave);

        return "Favorites reordered";
    }

    @PostMapping("/import-from-disk")
    public ResponseEntity<Map<String, Object>> importFromDisk() {
        return ResponseEntity.ok(videoImportService.importFromDisk());
    }

    @PostMapping("/migrate-obfuscation")
    public ResponseEntity<Map<String, Object>> migrateObfuscation() {
        return ResponseEntity.ok(obfuscationMigrationService.migrateExisting());
    }

    @PostMapping("/upload")
    public ResponseEntity<String> uploadVideo(
            @RequestParam String title,
            @RequestParam String fileName,
            @RequestParam String creators,
            @RequestParam(required = false) Integer sourceIndex,
            @RequestParam("thumbnail") MultipartFile thumbnailFile,
            @RequestParam(value = "videoFile", required = false) MultipartFile videoFile
    ) {
        try {
            // Les fichiers sont brouillés sur disque : on renomme vers l'extension interne.
            String baseName = fileName.contains(".") ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
            String storedFileName = baseName + "." + com.local.ar44.service.FileObfuscationService.VIDEO_EXTENSION;

            // Création de l'entité Video
            Video video = new Video();
            video.setTitle(title);
            video.setFileName(storedFileName);
            if (sourceIndex != null) video.setSourceIndex(sourceIndex);
            video.setCreatedAt(LocalDateTime.now());
            // Créateurs (optionnel)
            if (creators != null && !creators.isBlank()) {
                List<String> creatorNames = Arrays.stream(creators.split(","))
                        .map(String::trim).filter(s -> !s.isEmpty()).toList();
                if (!creatorNames.isEmpty()) {
                    Set<com.local.ar44.dto.Creator> creatorSet = new HashSet<>();
                    for (String name : creatorNames) {
                        creatorSet.add(creatorService.findOrCreateByName(name));
                    }
                    video.setCreators(creatorSet);
                }
            }
            // Sauvegarde de la vidéo en base (pour avoir l'ID)
            video = videoRepository.save(video);
            // Enregistrement du thumbnail (obligatoire)
            if (thumbnailFile == null || thumbnailFile.isEmpty()) {
                return ResponseEntity.badRequest().body("Thumbnail obligatoire");
            }
            Path thumbPath = thumbnailStorageService.getThumbPath(storedFileName);
            Files.createDirectories(thumbPath.getParent());
            Files.write(thumbPath, fileObfuscationService.transform(thumbnailFile.getBytes()));
            // Enregistrement du fichier vidéo (optionnel)
            if (videoFile != null && !videoFile.isEmpty()) {
                Path videoPath = Paths.get(videosDir, storedFileName).toAbsolutePath();
                Files.createDirectories(videoPath.getParent());
                try (var in = videoFile.getInputStream(); var out = Files.newOutputStream(videoPath)) {
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
            return ResponseEntity.ok("Ajouté");
        } catch (Exception e) {
            log.error("[UPLOAD] Erreur ajout vidéo: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Erreur: " + e.getMessage());
        }
    }
}
