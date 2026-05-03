package com.sheetmusic.score;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

/**
 * One nested reference in the upload-time-attachment payload
 * ({@code metadata.references[]}). All-JSON; no multipart sibling.
 */
public record ReferenceUploadRequest(
        @NotBlank String url,
        String label,
        String kind,
        Integer sortOrder,
        @Valid List<NoteUploadRequest> notes
) {
}
