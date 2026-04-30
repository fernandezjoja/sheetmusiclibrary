package com.sheetmusic.score;

import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sheetmusic.storage.FileStorageService;
import com.sheetmusic.storage.FileType;

@RestController
@RequestMapping("/api/scores")
public class ScoreController {

    private final ScoreService scores;
    private final FileStorageService storage;

    public ScoreController(ScoreService scores, FileStorageService storage) {
        this.scores = scores;
        this.storage = storage;
    }

    @GetMapping
    public List<Score> list() {
        return scores.list();
    }

    @GetMapping("/{id}")
    public Score get(@PathVariable Long id) {
        return scores.get(id);
    }

    @GetMapping("/{id}/musicxml")
    public ResponseEntity<Resource> getMusicxml(@PathVariable Long id) {
        return streamFile(scores.get(id).getMusicxmlPath(), FileType.MUSICXML);
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<Resource> getPdf(@PathVariable Long id) {
        return streamFile(scores.get(id).getPdfPath(), FileType.PDF);
    }

    private ResponseEntity<Resource> streamFile(String path, FileType type) {
        if (path == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(type.mediaType())
                .body(storage.load(path));
    }
}
