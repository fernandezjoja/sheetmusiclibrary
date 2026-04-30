package com.sheetmusic.score;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class ScoreNotFoundException extends RuntimeException {
    public ScoreNotFoundException(Long id) {
        super("Score not found: " + id);
    }
}
