package com.sheetmusic.score;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

/**
 * Score metadata payload for create + update. {@code published} is optional;
 * when omitted on create, the score defaults to false (test/draft). On
 * update, omitting it means "leave the published state alone."
 */
public record CreateScoreRequest(
        @NotBlank String title,
        String composer,
        List<String> tags,
        Boolean published
) {
}
