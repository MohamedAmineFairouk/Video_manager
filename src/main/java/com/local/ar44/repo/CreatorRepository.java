package com.local.ar44.repo;

import com.local.ar44.dto.Creator;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CreatorRepository extends JpaRepository<Creator, Long> {
    Optional<Creator> findByNameIgnoreCase(String name);
}
