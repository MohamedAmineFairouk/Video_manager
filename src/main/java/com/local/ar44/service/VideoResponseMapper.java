package com.local.ar44.service;

import com.local.ar44.dto.Creator;
import com.local.ar44.dto.Video;
import com.local.ar44.dto.VideoResponse;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class VideoResponseMapper {

    public VideoResponse toResponse(Video video) {
        String fileName = video.getFileName();
        if (fileName == null || fileName.isEmpty()) {
            fileName = video.getTitle();
        }

        VideoResponse response = new VideoResponse();
        response.setId(video.getId());
        response.setTitle(video.getTitle());
        response.setFileName(fileName);
        response.setDurationMs(video.getDurationMs());
        response.setCreators(
                video.getCreators() == null ? List.of() :
                        video.getCreators().stream()
                                .map(Creator::getName)
                                .sorted()
                                .toList()
        );
        response.setFavorite(video.getFavorite());
        response.setSourceIndex(video.getSourceIndex());
        response.setUrl("/api/videos/file?fileName=" + URLEncoder.encode(fileName, StandardCharsets.UTF_8));
        response.setFavoriteOrder(video.getFavoriteOrder());
        return response;
    }
}
