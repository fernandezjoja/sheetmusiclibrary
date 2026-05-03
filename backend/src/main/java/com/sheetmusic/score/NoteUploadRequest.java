package com.sheetmusic.score;

import jakarta.validation.constraints.NotBlank;

/**
 * One nested note in the upload-time-attachment payload (under
 * {@code metadata.recordings[].notes[]} or {@code metadata.references[].notes[]}).
 */
public record NoteUploadRequest(
        @NotBlank String body,
        Integer sortOrder
) {
}
