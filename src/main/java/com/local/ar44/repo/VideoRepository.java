package com.local.ar44.repo;

import com.local.ar44.dto.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {
    // List<Video> findByCreatorIgnoreCase(String creator); // supprimé : plus de champ creator
    // Titre obfusqué en base (voir TitleObfuscationConverter) : plus de recherche SQL sur ce champ,
    // le filtrage par titre se fait désormais côté Java sur la valeur décodée (cf. VideoController#search).
    List<Video> findByFavoriteTrue();
    List<Video> findByFavoriteTrueOrderByFavoriteAtDesc();

    // Retourne les favoris ordonnés par favoriteOrder asc (nulls last) puis par favoriteAt desc
    @Query("select v from Video v where v.favorite = true order by v.favoriteOrder asc nulls last, v.favoriteAt desc")
    List<Video> findFavoritesOrdered();

    // Trouve la video favorite ayant le plus grand favoriteOrder
    Optional<Video> findTopByFavoriteTrueOrderByFavoriteOrderDesc();

    // Requêtes SQL brutes (colonne physique, pas l'attribut converti par JPA) utilisées par
    // TitleObfuscationMigrationRunner pour trouver et réécrire les titres pas encore obfusqués.
    // Un simple save() via l'entité ne suffirait pas : sans changement de valeur Java, Hibernate
    // ne détecterait aucune modification "dirty" et n'émettrait pas l'UPDATE.
    @Query(value = "SELECT id, title FROM video WHERE title IS NOT NULL AND title NOT LIKE 'OBF1:%'", nativeQuery = true)
    List<Object[]> findPlainTitleRows();

    @Modifying
    @Transactional
    @Query(value = "UPDATE video SET title = :title WHERE id = :id", nativeQuery = true)
    void updateTitleRaw(@Param("id") Long id, @Param("title") String title);

    // @Query supprimé : plus de champ creator
    // List<String> findDistinctCreators();
}
