package com.sheetmusic.score;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scores")
public class ScoreController {

    private final ScoreRepository repo;

    public ScoreController(ScoreRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<Score> list() {
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Score> get(@PathVariable Long id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
