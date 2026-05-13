package com.sheetmusic.score;

import java.util.List;

/**
 * Slim read-side representation used by all listing endpoints. Carries only
 * the fields the library / admin / Octoechos / Grandes-Fiestas pages render:
 * id, title, composer, tags, published flag, and file-presence booleans.
 *
 * <p>Recordings, references, notes, and raw file paths intentionally stay off
 * the wire here — listing UIs don't render any of them. Loading them would
 * trigger the per-row lazy-collection fetches that bog down /api/scores on
 * the Neon cloud DB; projecting to this record from inside ScoreService's
 * transaction sidesteps that entirely.
 *
 * <p>Piece-detail pages (player, edit form) keep using {@link ScoreView}, which
 * carries the full nested graph.
 */
public record ScoreListItem(
        Long id,
        String title,
        String composer,
        List<String> tags,
        boolean published,
        boolean hasMusicxml,
        boolean hasPdf,
        /**
         * True only when the score has a .mscz file AND the requester has
         * permission to download it (COLLABORATOR or higher). Same per-perms
         * gating as ScoreView.hasMscz.
         */
        boolean hasMscz) {
}
