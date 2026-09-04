package com.local.ar44.dto;

import lombok.Data;
import java.util.List;

@Data
public class VideoResponse {
    private Long id;
    private String title;
    private String fileName;
    private String url;
    private Long durationMs;
    private List<String> creators;
    private List<String> tags;
    private Integer sourceIndex;
    private Boolean favorite;
    private Integer favoriteOrder; // nouvellement exposé au front-end
    private Long viewCount;

    // getters/setters
}