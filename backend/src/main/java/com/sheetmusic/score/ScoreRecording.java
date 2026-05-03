package com.sheetmusic.score;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "score_recordings")
@Getter
@Setter
@NoArgsConstructor
public class ScoreRecording {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Back-reference to the parent score. JsonIgnore breaks the otherwise-infinite
     * Score → recordings → Score → recordings cycle when Jackson serializes.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "score_id", nullable = false)
    @JsonIgnore
    private Score score;

    /** Storage-relative path, e.g. "recordings/abc123.mp3". Resolved through FileStorageService. */
    @Column(nullable = false)
    private String path;

    private String label;

    /** Original upload filename, used for Content-Disposition on download. */
    @Column(name = "original_filename")
    private String originalFilename;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt = Instant.now();

    @OneToMany(mappedBy = "recording", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC, id ASC")
    private List<ScoreRecordingNote> notes = new ArrayList<>();
}
