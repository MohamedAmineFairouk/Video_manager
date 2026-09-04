package com.local.ar44.controller;

import com.local.ar44.dto.PlaylistResponse;
import com.local.ar44.service.PlaylistService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/playlists")
public class PlaylistController {

    private final PlaylistService playlistService;

    public PlaylistController(PlaylistService playlistService) {
        this.playlistService = playlistService;
    }

    @GetMapping
    public List<PlaylistResponse> getPlaylists() {
        return playlistService.getAllPlaylists();
    }

    @GetMapping("/{id}")
    public PlaylistResponse getPlaylist(@PathVariable Long id) {
        return playlistService.getPlaylistDetail(id);
    }

    @PostMapping
    public ResponseEntity<PlaylistResponse> createPlaylist(@RequestBody Map<String, String> body) {
        String name = body.get("name") == null ? "" : body.get("name").trim();
        if (name.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(playlistService.createPlaylist(name));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PlaylistResponse> renamePlaylist(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String name = body.get("name") == null ? "" : body.get("name").trim();
        if (name.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(playlistService.renamePlaylist(id, name));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlaylist(@PathVariable Long id) {
        playlistService.deletePlaylist(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/videos")
    public ResponseEntity<PlaylistResponse> addVideo(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long videoId = toLong(body.get("videoId"));
        if (videoId == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(playlistService.addVideo(id, videoId));
    }

    @DeleteMapping("/{id}/videos/{videoId}")
    public ResponseEntity<Void> removeVideo(@PathVariable Long id, @PathVariable Long videoId) {
        playlistService.removeVideo(id, videoId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/reorder")
    public ResponseEntity<Void> reorder(@PathVariable Long id, @RequestBody List<Long> orderedVideoIds) {
        playlistService.reorder(id, orderedVideoIds);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/membership/{videoId}")
    public List<Long> getMembership(@PathVariable Long videoId) {
        return playlistService.getPlaylistIdsForVideo(videoId);
    }

    private Long toLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        if (value instanceof String s) {
            try {
                return Long.parseLong(s);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
