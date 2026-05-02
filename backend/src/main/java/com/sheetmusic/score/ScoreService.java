package com.sheetmusic.score;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.sheetmusic.storage.FileStorageService;
import com.sheetmusic.storage.FileType;

@Service
public class ScoreService {

    private final ScoreRepository repo;
    private final FileStorageService storage;

    public ScoreService(ScoreRepository repo, FileStorageService storage) {
        this.repo = repo;
        this.storage = storage;
    }

    /**
     * @param includeUnpublished true for logged-in users (USER or ADMIN);
     *                           false for anonymous, who only see published.
     */
    @Transactional(readOnly = true)
    public List<Score> list(boolean includeUnpublished) {
        return includeUnpublished ? repo.findAll() : repo.findByPublishedTrue();
    }

    /**
     * Anonymous viewers get a 404 (via ScoreNotFoundException) for unpublished
     * scores — same response as a non-existent id, so existence isn't leaked.
     */
    @Transactional(readOnly = true)
    public Score get(Long id, boolean includeUnpublished) {
        Score score = repo.findById(id).orElseThrow(() -> new ScoreNotFoundException(id));
        if (!includeUnpublished && !score.isPublished()) {
            throw new ScoreNotFoundException(id);
        }
        return score;
    }

    @Transactional
    public Score create(CreateScoreRequest meta, MultipartFile musicxml, MultipartFile pdf, MultipartFile mscz) {
        // Files are written first; if the DB save throws, files orphan on disk.
        // A periodic sweep can reconcile orphans if it ever becomes a problem.
        Score score = new Score();
        score.setTitle(meta.title().trim());
        score.setComposer(meta.composer() == null ? null : meta.composer().trim());
        score.setTags(normalizeTags(meta.tags()));
        // Default false; admin can opt-in by passing true at creation time.
        score.setPublished(Boolean.TRUE.equals(meta.published()));
        score.setMusicxmlPath(storage.store(musicxml, FileType.MUSICXML));
        score.setPdfPath(storage.store(pdf, FileType.PDF));
        if (mscz != null && !mscz.isEmpty()) {
            score.setMsczPath(storage.store(mscz, FileType.MSCZ));
        }
        return repo.save(score);
    }

    /**
     * Partial update: any non-null arg replaces the corresponding piece of the score.
     * Old files are deleted only after the DB save succeeds, so a mid-flight failure
     * leaves the original score intact (with at most an orphaned new file on disk).
     */
    @Transactional
    public Score update(Long id, CreateScoreRequest meta, MultipartFile musicxml, MultipartFile pdf, MultipartFile mscz) {
        Score score = repo.findById(id).orElseThrow(() -> new ScoreNotFoundException(id));
        List<String> pathsToDelete = new ArrayList<>();

        if (meta != null) {
            score.setTitle(meta.title().trim());
            score.setComposer(meta.composer() == null ? null : meta.composer().trim());
            score.setTags(normalizeTags(meta.tags()));
            // Only flip published if the request explicitly carries it (a value
            // of `null` means "leave it alone" — same convention as files).
            if (meta.published() != null) {
                score.setPublished(meta.published());
            }
        }
        if (musicxml != null && !musicxml.isEmpty()) {
            pathsToDelete.add(score.getMusicxmlPath());
            score.setMusicxmlPath(storage.store(musicxml, FileType.MUSICXML));
        }
        if (pdf != null && !pdf.isEmpty()) {
            pathsToDelete.add(score.getPdfPath());
            score.setPdfPath(storage.store(pdf, FileType.PDF));
        }
        if (mscz != null && !mscz.isEmpty()) {
            pathsToDelete.add(score.getMsczPath());
            score.setMsczPath(storage.store(mscz, FileType.MSCZ));
        }

        Score saved = repo.save(score);
        // Old files removed only on success. delete() swallows missing-file errors.
        pathsToDelete.forEach(storage::delete);
        return saved;
    }

    private static List<String> normalizeTags(List<String> raw) {
        if (raw == null) return List.of();
        return raw.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase(java.util.Locale.ROOT))
                .distinct()
                .toList();
    }
}
