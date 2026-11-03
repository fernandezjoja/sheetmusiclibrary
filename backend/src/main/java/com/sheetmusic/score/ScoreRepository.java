package com.sheetmusic.score;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScoreRepository extends JpaRepository<Score, Long> {
    /** Published scores: the only ones roles without canSeeUnpublished can see. */
    List<Score> findByPublishedTrue();
}
