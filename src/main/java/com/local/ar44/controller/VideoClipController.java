package com.local.ar44.controller;

import com.local.ar44.service.VideoClipService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Éditeur "✂ Découper" : création d'une nouvelle vidéo à partir de segments d'une vidéo. */
@RestController
@RequestMapping("/api/videos")
public class VideoClipController {

    private final VideoClipService videoClipService;

    public VideoClipController(VideoClipService videoClipService) {
        this.videoClipService = videoClipService;
    }

    // Corps : { "title": "...", "volume": 1.5, "segments": [ { "start": 12.5, "end": 40 }, ... ] }
    // (secondes ; volume = multiplicateur du son, 1 = inchangé ; sans segment, toute la vidéo)
    @PostMapping("/{id}/clip")
    public ResponseEntity<?> createClip(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        List<VideoClipService.Segment> segments = new ArrayList<>();
        if (body.get("segments") instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> m && m.get("start") instanceof Number s && m.get("end") instanceof Number e) {
                    segments.add(new VideoClipService.Segment(s.doubleValue(), e.doubleValue()));
                }
            }
        }
        String title = body.get("title") instanceof String t ? t : null;
        double volume = body.get("volume") instanceof Number v ? v.doubleValue() : 1.0;
        try {
            return ResponseEntity.ok(videoClipService.start(id, segments, title, volume).toMap());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/clip-jobs")
    public List<Map<String, Object>> listJobs() {
        return videoClipService.listJobs().stream().map(VideoClipService.ClipJob::toMap).toList();
    }

    @GetMapping("/clip-jobs/{jobId}")
    public ResponseEntity<Map<String, Object>> getJob(@PathVariable String jobId) {
        VideoClipService.ClipJob job = videoClipService.getJob(jobId);
        return job == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(job.toMap());
    }
}
