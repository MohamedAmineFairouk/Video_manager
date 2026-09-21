package com.local.ar44.repo;

import com.local.ar44.dto.PlaylistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PlaylistItemRepository extends JpaRepository<PlaylistItem, Long> {
    List<PlaylistItem> findByPlaylistIdOrderByPositionAsc(Long playlistId);

    Optional<PlaylistItem> findByPlaylistIdAndVideoId(Long playlistId, Long videoId);

    Optional<PlaylistItem> findTopByPlaylistIdOrderByPositionDesc(Long playlistId);

    List<PlaylistItem> findByVideoId(Long videoId);

    void deleteByPlaylistIdAndVideoId(Long playlistId, Long videoId);

    void deleteByPlaylistId(Long playlistId);

    void deleteByVideoId(Long videoId);

    // Utilisé par "Découverte aléatoire" pour exclure les vidéos déjà présentes dans une playlist.
    @Query("select distinct pi.video.id from PlaylistItem pi")
    List<Long> findDistinctVideoIds();
}
