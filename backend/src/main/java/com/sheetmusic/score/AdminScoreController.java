package com.sheetmusic.score;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
}
