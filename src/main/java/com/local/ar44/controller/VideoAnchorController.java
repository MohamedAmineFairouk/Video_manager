package com.local.ar44.controller;

import com.local.ar44.dto.Video;
import com.local.ar44.dto.VideoAnchor;
import com.local.ar44.dto.VideoAnchorResponse;
import com.local.ar44.repo.VideoAnchorRepository;
import com.local.ar44.repo.VideoRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/videos/{videoId}/anchors")
public class VideoAnchorController {

    private final VideoAnchorRepository anchorRepository;
    private final VideoRepository videoRepository;

    public VideoAnchorController(VideoAnchorRepository anchorRepository, VideoRepository videoRepository) {
        this.anchorRepository = anchorRepository;
        this.videoRepository = videoRepository;
    }

    private VideoAnchorResponse toResponse(VideoAnchor a) {
        return new VideoAnchorResponse(a.getId(), a.getSeconds());
    }

    @GetMapping
    public List<VideoAnchorResponse> list(@PathVariable Long videoId) {
        return anchorRepository.findByVideoIdOrderBySecondsAsc(videoId)
                .stream().map(this::toResponse).toList();
    }

    @PostMapping
    public VideoAnchorResponse create(@PathVariable Long videoId, @RequestParam Integer seconds) {
        Video video = videoRepository.findById(videoId).orElseThrow();
        VideoAnchor anchor = new VideoAnchor();
        anchor.setVideo(video);
        anchor.setSeconds(Math.max(0, seconds));
        anchor.setCreatedAt(LocalDateTime.now());
        return toResponse(anchorRepository.save(anchor));
    }

    @DeleteMapping("/{anchorId}")
    public ResponseEntity<Void> delete(@PathVariable Long videoId, @PathVariable Long anchorId) {
        anchorRepository.deleteByIdInAndVideoId(List.of(anchorId), videoId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/delete-batch")
    public ResponseEntity<Void> deleteBatch(@PathVariable Long videoId, @RequestBody List<Long> ids) {
        if (ids != null && !ids.isEmpty()) {
            anchorRepository.deleteByIdInAndVideoId(ids, videoId);
        }
        return ResponseEntity.ok().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAll(@PathVariable Long videoId) {
        anchorRepository.deleteByVideoId(videoId);
        return ResponseEntity.ok().build();
    }
}
