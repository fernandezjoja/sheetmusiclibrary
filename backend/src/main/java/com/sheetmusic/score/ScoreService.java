package com.sheetmusic.score;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.sheetmusic.security.Permissions;
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
     * Slim projection for every listing endpoint: returns only the columns the
     * library / admin / Octoechos / Grandes-Fiestas pages render. Recordings,
     * references, notes, and raw file paths stay off the wire — touching them
     * here would re-introduce the per-row lazy-collection fetches that bog
     * down Neon round-trips. Projection happens inside the transaction so
     * lazy proxies never escape.
     *
     * <p>{@code perms.canSeeUnpublished()} gates whether unpublished (test)
     * scores are visible. {@code perms.canDownloadMscz()} gates the
     * {@code hasMscz} flag the same way {@link ScoreView} does for detail.
     */
    @Transactional(readOnly = true)
    public List<ScoreListItem> listSlim(Permissions perms) {
        List<Score> scores = perms.canSeeUnpublished()
                ? repo.findAll()
                : repo.findByPublishedTrue();
        boolean canSeeMscz = perms.canDownloadMscz();
        return scores.stream()
                .map(s -> new ScoreListItem(
                        s.getId(),
                        s.getTitle(),
                        s.getComposer(),
                        s.getTags(),
                        s.isPublished(),
                        s.getMusicxmlPath() != null,
                        s.getPdfPath() != null,
                        s.getMsczPath() != null && canSeeMscz))
                .toList();
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
        initializeAttachments(score);
        return score;
    }

    /**
     * Creates a score plus optional 0+ recordings and 0+ references (each with 0+ notes)
     * in a single transaction. {@code recordingFiles} must align 1:1 with
     * {@code meta.recordings()}; mismatched sizes throw 400.
     *
     * <p>Files are written first; if the DB save throws, files orphan in storage.
     * A periodic sweep can reconcile orphans if it ever becomes a problem.
     * Cascade=ALL on Score's @OneToMany collections persists the entire nested
     * graph through one repo.save(score).
     */
    @Transactional
    public Score create(CreateScoreRequest meta,
                        MultipartFile musicxml,
                        MultipartFile pdf,
                        MultipartFile mscz,
                        List<MultipartFile> recordingFiles) {
        int expectedRecordings = meta.recordings() == null ? 0 : meta.recordings().size();
        int actualRecordings = recordingFiles == null ? 0 : recordingFiles.size();
        if (expectedRecordings != actualRecordings) {
            throw new IllegalArgumentException(
                    "metadata.recordings count (" + expectedRecordings
                            + ") must match recording multipart parts (" + actualRecordings + ")");
        }

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

        for (int i = 0; i < expectedRecordings; i++) {
            score.getRecordings().add(buildRecording(score, meta.recordings().get(i), recordingFiles.get(i)));
        }
        if (meta.references() != null) {
            for (ReferenceUploadRequest refReq : meta.references()) {
                score.getReferences().add(buildReference(score, refReq));
            }
        }

        return repo.save(score);
    }

    private ScoreRecording buildRecording(Score score, RecordingUploadRequest req, MultipartFile file) {
        ScoreRecording rec = new ScoreRecording();
        rec.setScore(score);
        rec.setPath(storage.store(file, FileType.RECORDING));
        rec.setOriginalFilename(file.getOriginalFilename());
        if (req.label() != null && !req.label().isBlank()) rec.setLabel(req.label().trim());
        if (req.sortOrder() != null) rec.setSortOrder(req.sortOrder());
        if (req.notes() != null) {
            for (NoteUploadRequest noteReq : req.notes()) {
                ScoreRecordingNote note = new ScoreRecordingNote();
                note.setRecording(rec);
                note.setBody(noteReq.body().trim());
                if (noteReq.sortOrder() != null) note.setSortOrder(noteReq.sortOrder());
                rec.getNotes().add(note);
            }
        }
        return rec;
    }

    private static ScoreReference buildReference(Score score, ReferenceUploadRequest req) {
        ScoreReference ref = new ScoreReference();
        ref.setScore(score);
        ref.setUrl(req.url().trim());
        if (req.label() != null && !req.label().isBlank()) ref.setLabel(req.label().trim());
        if (req.kind() != null && !req.kind().isBlank()) ref.setKind(req.kind().trim());
        if (req.sortOrder() != null) ref.setSortOrder(req.sortOrder());
        if (req.notes() != null) {
            for (NoteUploadRequest noteReq : req.notes()) {
                ScoreReferenceNote note = new ScoreReferenceNote();
                note.setReference(ref);
                note.setBody(noteReq.body().trim());
                if (noteReq.sortOrder() != null) note.setSortOrder(noteReq.sortOrder());
                ref.getNotes().add(note);
            }
        }
        return ref;
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
        initializeAttachments(saved);
        return saved;
    }

    /**
     * Hard delete: removes the score row (cascades attachments + their notes via DB
     * ON DELETE CASCADE) and best-effort removes all associated blobs (musicxml,
     * pdf, mscz, every recording's mp3) from storage.
     */
    @Transactional
    public void delete(Long id) {
        Score score = repo.findById(id).orElseThrow(() -> new ScoreNotFoundException(id));
        List<String> pathsToDelete = new ArrayList<>();
        pathsToDelete.add(score.getMusicxmlPath());
        pathsToDelete.add(score.getPdfPath());
        pathsToDelete.add(score.getMsczPath());
        for (ScoreRecording rec : score.getRecordings()) {
            pathsToDelete.add(rec.getPath());
        }
        repo.delete(score);
        // Files removed after the DB delete commits; storage.delete swallows nulls + missing files.
        pathsToDelete.forEach(storage::delete);
    }

    /**
     * Force-load lazy attachment collections (recordings + references and their notes)
     * so Jackson can serialize them after the @Transactional method returns. We run with
     * spring.jpa.open-in-view: false, so serialization happens outside the Hibernate
     * session — uninitialized proxies would throw LazyInitializationException.
     *
     * For a parish-scale library this triggers N+1 queries per list call; revisit with
     * @BatchSize / @EntityGraph if the access log shows it becoming a problem.
     */
    private static void initializeAttachments(Score score) {
        for (ScoreRecording r : score.getRecordings()) {
            r.getNotes().size();
        }
        for (ScoreReference r : score.getReferences()) {
            r.getNotes().size();
        }
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
