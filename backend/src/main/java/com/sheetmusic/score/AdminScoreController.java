package com.sheetmusic.score;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.sheetmusic.security.Permissions;

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
    public ScoreView create(
            @RequestPart("metadata") @Valid CreateScoreRequest metadata,
            @RequestPart("musicxml") MultipartFile musicxml,
            @RequestPart("pdf") MultipartFile pdf,
            @RequestPart(value = "mscz", required = false) MultipartFile mscz,
            @RequestPart(value = "recording", required = false) List<MultipartFile> recordings
    ) {
        return ScoreView.from(scores.create(metadata, musicxml, pdf, mscz, recordings), currentPerms());
    }

    /**
     * Partial update. Any part may be omitted; only the parts present are replaced.
     * Sending {@code metadata} replaces all metadata fields wholesale (title, composer, tags).
     */
    @PatchMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScoreView update(
            @PathVariable Long id,
            @RequestPart(value = "metadata", required = false) @Valid CreateScoreRequest metadata,
            @RequestPart(value = "musicxml", required = false) MultipartFile musicxml,
            @RequestPart(value = "pdf", required = false) MultipartFile pdf,
            @RequestPart(value = "mscz", required = false) MultipartFile mscz
    ) {
        return ScoreView.from(scores.update(id, metadata, musicxml, pdf, mscz), currentPerms());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        scores.delete(id);
    }

    private static Permissions currentPerms() {
        return Permissions.from(SecurityContextHolder.getContext().getAuthentication());
    }
}
