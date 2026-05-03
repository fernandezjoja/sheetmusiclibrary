package com.sheetmusic.score;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * 404 for any score attachment (recording, reference, or note) — including
 * cross-score lookups (e.g. recording id 5 doesn't belong to score id 2).
 * Mirrors {@link ScoreNotFoundException}'s "don't leak existence" stance.
 */
@ResponseStatus(HttpStatus.NOT_FOUND)
public class AttachmentNotFoundException extends RuntimeException {
    public AttachmentNotFoundException(String type, Long id) {
        super(type + " not found: " + id);
    }
}
