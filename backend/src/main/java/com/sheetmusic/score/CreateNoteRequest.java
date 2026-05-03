package com.sheetmusic.score;

import jakarta.validation.constraints.NotBlank;

/**
 * Body for POST .../notes (both recording-notes and reference-notes share this shape).
 */
public record CreateNoteRequest(
        @NotBlank String body,
        Integer sortOrder
) {
}
