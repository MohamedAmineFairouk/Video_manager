package com.local.ar44.repo;

import com.local.ar44.dto.VideoAnchor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface VideoAnchorRepository extends JpaRepository<VideoAnchor, Long> {
    List<VideoAnchor> findByVideoIdOrderBySecondsAsc(Long videoId);

    @Modifying
    @Transactional
    @Query("delete from VideoAnchor a where a.video.id = :videoId")
    void deleteByVideoId(@Param("videoId") Long videoId);

    @Modifying
    @Transactional
    @Query("delete from VideoAnchor a where a.id in :ids and a.video.id = :videoId")
    void deleteByIdInAndVideoId(@Param("ids") List<Long> ids, @Param("videoId") Long videoId);
}
