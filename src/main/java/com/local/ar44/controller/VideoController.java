package com.local.ar44.controller;

import com.local.ar44.dto.AppConfig;
import com.local.ar44.dto.UpdateVideoRequest;
import com.local.ar44.dto.Creator;
import com.local.ar44.dto.Video;
import com.local.ar44.dto.VideoResponse;
import com.local.ar44.repo.AppConfigRepository;
import com.local.ar44.repo.VideoRepository;
import com.local.ar44.service.StatsService;
import com.local.ar44.service.ThumbnailStorageService;
import com.local.ar44.service.VideoResponseMapper;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
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
    private final com.local.ar44.service.CreatorService creatorService;
    private final StatsService statsService;
    private final ThumbnailStorageService thumbnailStorageService;
    private final VideoResponseMapper videoResponseMapper;

    public VideoController(VideoRepository videoRepository,
                           AppConfigRepository appConfigRepository,
                           StatsService statsService,
                           ThumbnailStorageService thumbnailStorageService,
                           com.local.ar44.service.CreatorService creatorService,
                           VideoResponseMapper videoResponseMapper) {
        this.videoRepository = videoRepository;
        this.appConfigRepository = appConfigRepository;
        this.statsService = statsService;
        this.thumbnailStorageService = thumbnailStorageService;
        this.creatorService = creatorService;
        this.videoResponseMapper = videoResponseMapper;
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

    @GetMapping("/file")
    public ResponseEntity<Resource> getVideoFile(@RequestParam String fileName) {
        Path videoPath = Paths.get(videosDir, fileName).toAbsolutePath();
        log.info("[VIDEO-READ] Demande de lecture pour {}", videoPath);
        if (!Files.exists(videoPath)) {
            log.error("[VIDEO-ERROR] Fichier vidéo introuvable: {}", videoPath);
            return ResponseEntity.notFound().build();
        }
        try {
            Resource resource = new UrlResource(videoPath.toUri());
            return ResponseEntity.ok()
                    .header("Content-Type", "video/mp4")
                    .body(resource);
        } catch (Exception e) {
            log.error("[VIDEO-ERROR] Erreur lors de la lecture de {}: {}", videoPath, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
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

    @GetMapping("/search")
    public List<VideoResponse> search(@RequestParam String q, HttpSession session) {
        resolveHost(session);
        return videoRepository.findByTitleContainingIgnoreCase(q)
                .stream()
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

        Video saved = videoRepository.save(v);
        resolveHost(session);
        return videoResponseMapper.toResponse(saved);
    }

    // ========================
    // ❌ DELETE VIDEO
    // ========================
    @GetMapping("/delete")
    public String deleteVideo(@RequestParam Long id) {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isEmpty()) {
            return "Vidéo introuvable : " + id;
        }
        Video video = videoOpt.get();
        String fileName = video.getFileName();
        // Détection du répertoire courant (là où se trouve le JAR)
        String currentDir = System.getProperty("user.dir");
        boolean isLinux = System.getProperty("os.name").toLowerCase().contains("linux");
        Path baseDir;
        if (isLinux) {
            baseDir = Paths.get(currentDir);
        } else {
            baseDir = Paths.get(videosDir);
        }
        // Suppression du fichier vidéo (dans le même dossier que le JAR si Linux)
        if (fileName != null && !fileName.isBlank()) {
            Path videoPath = baseDir.resolve(fileName).toAbsolutePath();
            try {
                if (Files.exists(videoPath) && Files.isRegularFile(videoPath)) {
                    Files.delete(videoPath);
                    log.info("[DELETE] Fichier vidéo supprimé: {}", videoPath);
                } else {
                    log.warn("[DELETE] Fichier vidéo introuvable ou non régulier: {}", videoPath);
                }
            } catch (Exception e) {
                log.error("[DELETE] Erreur suppression fichier vidéo: {}", e.getMessage());
            }
        }
        // Suppression du thumbnail (dans le même dossier que le JAR si Linux)
        try {
            String thumbName = thumbnailStorageService.toThumbnailName(fileName);
            Path thumbPath = baseDir.resolve(thumbName).toAbsolutePath();
            if (Files.exists(thumbPath) && Files.isRegularFile(thumbPath)) {
                Files.delete(thumbPath);
                log.info("[DELETE] Thumbnail supprimé: {}", thumbPath);
            } else {
                log.warn("[DELETE] Thumbnail introuvable ou non régulier: {}", thumbPath);
            }
        } catch (Exception e) {
            log.error("[DELETE] Erreur suppression thumbnail: {}", e.getMessage());
        }
        videoRepository.deleteById(id);
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
    public ResponseEntity<Resource> getThumbnail(@RequestParam Long id) throws MalformedURLException {
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

        Resource resource = new UrlResource(path.toUri());
        return ResponseEntity.ok()
                .header("Content-Type", "image/jpeg")
                .body(resource);
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
            // Création de l'entité Video
            Video video = new Video();
            video.setTitle(title);
            video.setFileName(fileName);
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
            Path thumbPath = thumbnailStorageService.getThumbPath(fileName);
            Files.createDirectories(thumbPath.getParent());
            try (var in = thumbnailFile.getInputStream()) {
                Files.copy(in, thumbPath, StandardCopyOption.REPLACE_EXISTING);
            }
            // Enregistrement du fichier vidéo (optionnel)
            if (videoFile != null && !videoFile.isEmpty()) {
                Path videoPath = Paths.get(videosDir, fileName).toAbsolutePath();
                Files.createDirectories(videoPath.getParent());
                try (var in = videoFile.getInputStream()) {
                    Files.copy(in, videoPath, StandardCopyOption.REPLACE_EXISTING);
                }
            }
            return ResponseEntity.ok("Ajouté");
        } catch (Exception e) {
            log.error("[UPLOAD] Erreur ajout vidéo: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Erreur: " + e.getMessage());
        }
    }
}
