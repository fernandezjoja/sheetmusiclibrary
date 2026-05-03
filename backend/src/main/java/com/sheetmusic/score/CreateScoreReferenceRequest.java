package com.sheetmusic.score;

import jakarta.validation.constraints.NotBlank;

/**
 * Body for POST /api/admin/scores/{id}/references.
 * {@code kind} is free-form ('youtube' / 'web' / null); the frontend may
 * auto-tag it from the URL pattern.
 */
public record CreateScoreReferenceRequest(
        @NotBlank String url,
        String label,
        String kind,
        Integer sortOrder
) {
}
