package com.sheetmusic.score;

import java.util.List;

import jakarta.validation.Valid;

/**
 * One nested recording in the upload-time-attachment payload
 * ({@code metadata.recordings[]}). The actual MP3 file rides as a separate
 * {@code recording} multipart part, matched to this entry by index.
 */
public record RecordingUploadRequest(
        String label,
        Integer sortOrder,
        @Valid List<NoteUploadRequest> notes
) {
}
