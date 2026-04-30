package com.sheetmusic.score;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin/scores")
public class AdminScoreController {

    private final ScoreService scores;

    public AdminScoreController(ScoreService scores) {
        this.scores = scores;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Score create(
            @RequestPart("metadata") @Valid CreateScoreRequest metadata,
            @RequestPart("musicxml") MultipartFile musicxml,
            @RequestPart("pdf") MultipartFile pdf,
            @RequestPart(value = "mscz", required = false) MultipartFile mscz
    ) {
        return scores.create(metadata, musicxml, pdf, mscz);
    }

    /**
     * Partial update. Any part may be omitted; only the parts present are replaced.
     * Sending {@code metadata} replaces all metadata fields wholesale (title, composer, tags).
     */
    @PatchMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Score update(
            @PathVariable Long id,
            @RequestPart(value = "metadata", required = false) @Valid CreateScoreRequest metadata,
            @RequestPart(value = "musicxml", required = false) MultipartFile musicxml,
            @RequestPart(value = "pdf", required = false) MultipartFile pdf,
            @RequestPart(value = "mscz", required = false) MultipartFile mscz
    ) {
        return scores.update(id, metadata, musicxml, pdf, mscz);
    }
}
