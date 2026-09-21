package com.local.ar44.dto;

import com.local.ar44.converter.TitleObfuscationConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
public class Playlist {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Même principe que le titre des vidéos (voir TitleObfuscationConverter) : le nom n'est
    // pas stocké en clair en base, décodage transparent à la lecture.
    @Convert(converter = TitleObfuscationConverter.class)
    @Column(length = 500)
    private String name;
    private LocalDateTime createdAt;
}
