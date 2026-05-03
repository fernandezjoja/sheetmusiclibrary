package com.sheetmusic.score;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

/**
 * Score metadata payload for create + update. {@code published} is optional;
 * when omitted on create, the score defaults to false (test/draft). On
 * update, omitting it means "leave the published state alone."
 *
 * <p>{@code recordings} and {@code references} are honored only by the create
 * endpoint and let the admin attach 0+ recordings / references (each with 0+
 * notes) atomically with the score itself. The MP3 files for {@code recordings}
 * ride alongside as repeated {@code recording} multipart parts, matched to
 * {@code recordings[i]} by index. Update ignores both fields — use the
 * granular {@code /recordings} and {@code /references} endpoints to manage
 * attachments after creation.
 */
public record CreateScoreRequest(
        @NotBlank String title,
        String composer,
        List<String> tags,
        Boolean published,
        @Valid List<RecordingUploadRequest> recordings,
        @Valid List<ReferenceUploadRequest> references
) {
}
