package com.sheetmusic.score;

import java.util.List;

import com.sheetmusic.security.Permissions;

/**
 * Public read-side representation of a {@link Score}. Same shape as the entity
 * for fields that all roles can see, but:
 * <ul>
 * <li>{@code msczPath} (internal storage path) is replaced by {@code hasMscz} —
 * a boolean that's true only when the file exists <em>and</em> the requester
 * has permission to download it. Frontend renders the download button on
 * that flag alone, no client-side role logic.</li>
 * <li>{@code references} is empty for callers without
 * {@link Permissions#canSeeReferences()}. Recordings are visible to all
 * (including anonymous, on published scores) since the streaming endpoint
 * is intentionally public for parishioner audio playback.</li>
 * </ul>
 *
 * <p>This DTO exists primarily to avoid mutating the JPA entity in-place: with
 * {@code cascade=ALL, orphanRemoval=true} on {@code Score.references},
 * clearing the collection on a managed entity could trigger cascade DELETEs on
 * flush even under {@code readOnly=true}. Mapping into a fresh record is the
 * safe path.
 */
public record ScoreView(
        Long id,
        String title,
        String composer,
        List<String> tags,
        String musicxmlPath,
        String pdfPath,
        boolean hasMscz,
        boolean published,
        List<ScoreRecording> recordings,
        List<ScoreReference> references) {

    public static ScoreView from(Score score, Permissions perms) {
        boolean hasMscz = score.getMsczPath() != null && perms.canDownloadMscz();
        List<ScoreReference> refs = perms.canSeeReferences() ? score.getReferences() : List.of();
        return new ScoreView(
                score.getId(),
                score.getTitle(),
                score.getComposer(),
                score.getTags(),
                score.getMusicxmlPath(),
                score.getPdfPath(),
                hasMscz,
                score.isPublished(),
                score.getRecordings(),
                refs);
    }
}
