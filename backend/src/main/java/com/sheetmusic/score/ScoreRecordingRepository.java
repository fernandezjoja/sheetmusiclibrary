package com.sheetmusic.score;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScoreRecordingRepository extends JpaRepository<ScoreRecording, Long> {
}
