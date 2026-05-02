package com.sheetmusic.score;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScoreRepository extends JpaRepository<Score, Long> {
    /** Anonymous-visible scores: only those flagged published. */
    List<Score> findByPublishedTrue();
}
