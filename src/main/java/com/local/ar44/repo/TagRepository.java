package com.local.ar44.repo;

import com.local.ar44.dto.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends JpaRepository<Tag, Long> {
    Optional<Tag> findByNameIgnoreCase(String name);

    @Query("select distinct t.name from Tag t order by t.name")
    List<String> findDistinctTagNames();
}
