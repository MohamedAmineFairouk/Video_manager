package com.local.ar44.repo;

import com.local.ar44.dto.VideoWatchLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VideoWatchLogRepository extends JpaRepository<VideoWatchLog, Long> {
    long countByVideoId(Long videoId);
}
