package com.local.ar44.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class PlaylistResponse {
    private Long id;
    private String name;
    private LocalDateTime createdAt;
    private int videoCount;
    private List<String> thumbnailUrls;
    private List<VideoResponse> videos; // populated only on the detail endpoint
}
