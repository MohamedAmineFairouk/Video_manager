
package com.local.ar44.service;

import com.local.ar44.dto.Creator;
import com.local.ar44.repo.CreatorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CreatorService {
        /**
         * Trouve un créateur par nom, ou le crée s'il n'existe pas
         */
        public Creator findOrCreateByName(String name) {
            if (name == null || name.isBlank()) throw new IllegalArgumentException("Nom de créateur requis");
            return findByName(name).orElseGet(() -> creatorRepository.save(new Creator(name)));
        }
    @Autowired
    private CreatorRepository creatorRepository;

    public List<Creator> findAll() {
        return creatorRepository.findAll();
    }

    public Optional<Creator> findById(Long id) {
        return creatorRepository.findById(id);
    }

    public Creator save(Creator creator) {
        return creatorRepository.save(creator);
    }

    public void deleteById(Long id) {
        creatorRepository.deleteById(id);
    }

    public Optional<Creator> findByName(String name) {
        return creatorRepository.findByNameIgnoreCase(name);
    }
}
