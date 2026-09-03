package com.local.ar44.repo;

import com.local.ar44.dto.Tag;
import com.local.ar44.dto.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TagRepository extends JpaRepository<Tag, Long> {
    Optional<Tag> findByNameIgnoreCase(String name);

    @Query("select distinct t.name from Tag t order by t.name")
    List<String> findDistinctTagNames();

    @Query("select distinct v from Video v join v.tags t where lower(t.name) = lower(:tagName)")
    List<Video> findVideosByTagName(String tagName);
}
