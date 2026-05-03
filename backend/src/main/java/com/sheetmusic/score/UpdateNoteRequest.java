package com.sheetmusic.score;

/**
 * Body for PATCH .../notes/{nid}. Either field may be omitted (null = no change).
 * Empty-string body is rejected at the service layer.
 */
public record UpdateNoteRequest(
        String body,
        Integer sortOrder
) {
}
