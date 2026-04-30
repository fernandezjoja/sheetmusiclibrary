package com.sheetmusic.score;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

public record CreateScoreRequest(
        @NotBlank String title,
        String composer,
        List<String> tags
) {
}
