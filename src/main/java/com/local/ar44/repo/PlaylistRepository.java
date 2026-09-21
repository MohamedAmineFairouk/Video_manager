package com.local.ar44.repo;

import com.local.ar44.dto.Playlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    // Requêtes SQL brutes (colonne physique, pas l'attribut converti par JPA), même principe
    // que VideoRepository#findPlainTitleRows / updateTitleRaw pour la migration des titres.
    @Query(value = "SELECT id, name FROM playlist WHERE name IS NOT NULL AND name NOT LIKE 'OBF1:%'", nativeQuery = true)
    List<Object[]> findPlainNameRows();

    @Modifying
    @Transactional
    @Query(value = "UPDATE playlist SET name = :name WHERE id = :id", nativeQuery = true)
    void updateNameRaw(@Param("id") Long id, @Param("name") String name);
}
