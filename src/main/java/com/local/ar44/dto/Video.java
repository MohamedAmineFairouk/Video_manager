package com.local.ar44.dto;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Data
@EqualsAndHashCode(exclude = "tags")
@ToString(exclude = "tags")
public class Video {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String fileName;
    private Long durationMs;
    private String url;
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "video_creator",
        joinColumns = @JoinColumn(name = "video_id"),
        inverseJoinColumns = @JoinColumn(name = "creator_id")
    )
    private Set<Creator> creators = new HashSet<>();
    
    @ManyToMany(cascade = CascadeType.PERSIST, fetch = FetchType.EAGER)
    @JoinTable(
        name = "video_tags",
        joinColumns = @JoinColumn(name = "video_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();
    
    private Integer sourceIndex; // vlc:id
    private String thumbnailUrl;
    private LocalDateTime createdAt;
    private Boolean favorite = false;
    private LocalDateTime favoriteAt;
    private LocalDateTime lastWatchedAt;
    private Integer favoriteOrder; // new field to store explicit order in favorites/playlists
}
