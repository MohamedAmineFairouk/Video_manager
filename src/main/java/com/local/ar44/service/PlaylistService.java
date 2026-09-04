package com.local.ar44.service;

import com.local.ar44.dto.Playlist;
import com.local.ar44.dto.PlaylistItem;
import com.local.ar44.dto.PlaylistResponse;
import com.local.ar44.dto.Video;
import com.local.ar44.repo.PlaylistItemRepository;
import com.local.ar44.repo.PlaylistRepository;
import com.local.ar44.repo.VideoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final PlaylistItemRepository playlistItemRepository;
    private final VideoRepository videoRepository;
    private final VideoResponseMapper videoResponseMapper;

    public PlaylistService(PlaylistRepository playlistRepository,
                            PlaylistItemRepository playlistItemRepository,
                            VideoRepository videoRepository,
                            VideoResponseMapper videoResponseMapper) {
        this.playlistRepository = playlistRepository;
        this.playlistItemRepository = playlistItemRepository;
        this.videoRepository = videoRepository;
        this.videoResponseMapper = videoResponseMapper;
    }

    private PlaylistResponse toSummary(Playlist playlist, List<PlaylistItem> items) {
        PlaylistResponse response = new PlaylistResponse();
        response.setId(playlist.getId());
        response.setName(playlist.getName());
        response.setCreatedAt(playlist.getCreatedAt());
        response.setVideoCount(items.size());
        response.setThumbnailUrls(items.stream()
                .limit(4)
                .map(item -> "/api/videos/thumbnail?id=" + item.getVideo().getId())
                .toList());
        return response;
    }

    public List<PlaylistResponse> getAllPlaylists() {
        return playlistRepository.findAll().stream()
                .sorted(Comparator.comparing(Playlist::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(playlist -> toSummary(playlist, playlistItemRepository.findByPlaylistIdOrderByPositionAsc(playlist.getId())))
                .toList();
    }

    public PlaylistResponse getPlaylistDetail(Long id) {
        Playlist playlist = playlistRepository.findById(id).orElseThrow();
        List<PlaylistItem> items = playlistItemRepository.findByPlaylistIdOrderByPositionAsc(id);
        PlaylistResponse response = toSummary(playlist, items);
        response.setVideos(items.stream()
                .map(item -> videoResponseMapper.toResponse(item.getVideo()))
                .toList());
        return response;
    }

    @Transactional
    public PlaylistResponse createPlaylist(String name) {
        Playlist playlist = new Playlist();
        playlist.setName(name.trim());
        playlist.setCreatedAt(LocalDateTime.now());
        playlist = playlistRepository.save(playlist);
        return toSummary(playlist, List.of());
    }

    @Transactional
    public PlaylistResponse renamePlaylist(Long id, String name) {
        Playlist playlist = playlistRepository.findById(id).orElseThrow();
        playlist.setName(name.trim());
        playlistRepository.save(playlist);
        return toSummary(playlist, playlistItemRepository.findByPlaylistIdOrderByPositionAsc(id));
    }

    @Transactional
    public void deletePlaylist(Long id) {
        playlistItemRepository.deleteByPlaylistId(id);
        playlistRepository.deleteById(id);
    }

    @Transactional
    public PlaylistResponse addVideo(Long playlistId, Long videoId) {
        Playlist playlist = playlistRepository.findById(playlistId).orElseThrow();
        if (playlistItemRepository.findByPlaylistIdAndVideoId(playlistId, videoId).isEmpty()) {
            Video video = videoRepository.findById(videoId).orElseThrow();
            int nextPosition = playlistItemRepository.findTopByPlaylistIdOrderByPositionDesc(playlistId)
                    .map(item -> item.getPosition() + 1)
                    .orElse(0);
            PlaylistItem item = new PlaylistItem();
            item.setPlaylist(playlist);
            item.setVideo(video);
            item.setPosition(nextPosition);
            item.setAddedAt(LocalDateTime.now());
            playlistItemRepository.save(item);
        }
        return toSummary(playlist, playlistItemRepository.findByPlaylistIdOrderByPositionAsc(playlistId));
    }

    @Transactional
    public void removeVideo(Long playlistId, Long videoId) {
        playlistItemRepository.deleteByPlaylistIdAndVideoId(playlistId, videoId);
    }

    @Transactional
    public void reorder(Long playlistId, List<Long> orderedVideoIds) {
        List<PlaylistItem> items = playlistItemRepository.findByPlaylistIdOrderByPositionAsc(playlistId);
        Map<Long, PlaylistItem> byVideoId = items.stream()
                .collect(Collectors.toMap(item -> item.getVideo().getId(), item -> item));

        List<PlaylistItem> toSave = new ArrayList<>();
        int position = 0;
        for (Long videoId : orderedVideoIds) {
            PlaylistItem item = byVideoId.remove(videoId);
            if (item != null) {
                item.setPosition(position++);
                toSave.add(item);
            }
        }
        for (PlaylistItem remaining : byVideoId.values()) {
            remaining.setPosition(position++);
            toSave.add(remaining);
        }
        playlistItemRepository.saveAll(toSave);
    }

    public List<Long> getPlaylistIdsForVideo(Long videoId) {
        return playlistItemRepository.findByVideoId(videoId).stream()
                .map(item -> item.getPlaylist().getId())
                .distinct()
                .toList();
    }
}
