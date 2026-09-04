package com.local.ar44.service;

import com.local.ar44.dto.Creator;
import com.local.ar44.dto.Video;
import com.local.ar44.repo.CreatorRepository;
import com.local.ar44.repo.VideoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class CreatorService {

    @Autowired
    private CreatorRepository creatorRepository;

    @Autowired
    private VideoRepository videoRepository;

    public Creator findOrCreateByName(String name) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Nom de créateur requis");
        return findByName(name).orElseGet(() -> creatorRepository.save(new Creator(name)));
    }

    public List<Creator> findAll() {
        return creatorRepository.findAll();
    }

    public Optional<Creator> findById(Long id) {
        return creatorRepository.findById(id);
    }

    public Creator save(Creator creator) {
        return creatorRepository.save(creator);
    }

    @Transactional
    public void deleteById(Long id) {
        List<Video> affected = videoRepository.findAll().stream()
                .filter(v -> v.getCreators() != null && v.getCreators().stream().anyMatch(c -> c.getId().equals(id)))
                .toList();
        for (Video v : affected) {
            v.getCreators().removeIf(c -> c.getId().equals(id));
        }
        videoRepository.saveAll(affected);
        creatorRepository.deleteById(id);
    }

    public Optional<Creator> findByName(String name) {
        return creatorRepository.findByNameIgnoreCase(name);
    }
}
