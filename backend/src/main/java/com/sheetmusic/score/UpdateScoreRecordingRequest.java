package com.sheetmusic.score;

/**
 * Body for PATCH /api/admin/scores/{id}/recordings/{rid}. Metadata-only edits;
 * the file blob is immutable (delete + re-upload to replace it).
 */
public record UpdateScoreRecordingRequest(
        String label,
        Integer sortOrder
) {
}
