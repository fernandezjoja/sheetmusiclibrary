package com.sheetmusic.score;

/**
 * Body for PATCH /api/admin/scores/{id}/references/{rid}. Any field can be
 * omitted ("leave alone") — null means no change. {@code url} cannot be set
 * to blank when present; service-layer validation rejects empty strings.
 */
public record UpdateScoreReferenceRequest(
        String url,
        String label,
        String kind,
        Integer sortOrder
) {
}
