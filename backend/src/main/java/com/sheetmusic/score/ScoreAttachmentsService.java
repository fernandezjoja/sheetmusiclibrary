package com.sheetmusic.score;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.sheetmusic.storage.FileStorageService;
import com.sheetmusic.storage.FileType;

/**
 * Add/edit/remove operations for score recordings, references, and their notes.
 * Read paths (public {@code GET /api/scores/{id}}) stay in {@link ScoreService};
 * this service is purely the write side plus the published-aware lookup used by
 * the public audio streaming endpoint.
 *
 * <p>404 model: any cross-score lookup ("recording id 5 doesn't belong to score
 * id 2") throws {@link AttachmentNotFoundException} — same response shape as
 * "id doesn't exist," so existence isn't leaked across scores.
 */
@Service
public class ScoreAttachmentsService {

    private final ScoreRepository scoreRepo;
    private final ScoreRecordingRepository recordingRepo;
    private final ScoreReferenceRepository referenceRepo;
    private final ScoreRecordingNoteRepository recordingNoteRepo;
    private final ScoreReferenceNoteRepository referenceNoteRepo;
    private final FileStorageService storage;

    public ScoreAttachmentsService(
            ScoreRepository scoreRepo,
            ScoreRecordingRepository recordingRepo,
            ScoreReferenceRepository referenceRepo,
            ScoreRecordingNoteRepository recordingNoteRepo,
            ScoreReferenceNoteRepository referenceNoteRepo,
            FileStorageService storage) {
        this.scoreRepo = scoreRepo;
        this.recordingRepo = recordingRepo;
        this.referenceRepo = referenceRepo;
        this.recordingNoteRepo = recordingNoteRepo;
        this.referenceNoteRepo = referenceNoteRepo;
        this.storage = storage;
    }

    // ---------- Recordings ----------

    @Transactional
    public ScoreRecording addRecording(Long scoreId, MultipartFile file, String label, Integer sortOrder) {
        Score score = requireScore(scoreId);
        ScoreRecording rec = new ScoreRecording();
        rec.setScore(score);
        rec.setPath(storage.store(file, FileType.RECORDING));
        rec.setOriginalFilename(file.getOriginalFilename());
        rec.setLabel(blankToNull(label));
        if (sortOrder != null) rec.setSortOrder(sortOrder);
        return recordingRepo.save(rec);
    }

    @Transactional
    public ScoreRecording updateRecording(Long scoreId, Long recordingId, UpdateScoreRecordingRequest req) {
        ScoreRecording rec = requireRecording(scoreId, recordingId);
        if (req.label() != null) rec.setLabel(blankToNull(req.label()));
        if (req.sortOrder() != null) rec.setSortOrder(req.sortOrder());
        ScoreRecording saved = recordingRepo.save(rec);
        saved.getNotes().size();
        return saved;
    }

    @Transactional
    public void deleteRecording(Long scoreId, Long recordingId) {
        ScoreRecording rec = requireRecording(scoreId, recordingId);
        String path = rec.getPath();
        recordingRepo.delete(rec);
        // File removed only after the row is gone; cascade takes the notes with it.
        // delete() swallows missing-file errors.
        storage.delete(path);
    }

    // ---------- References ----------

    @Transactional
    public ScoreReference addReference(Long scoreId, CreateScoreReferenceRequest req) {
        Score score = requireScore(scoreId);
        ScoreReference ref = new ScoreReference();
        ref.setScore(score);
        ref.setUrl(req.url().trim());
        ref.setLabel(blankToNull(req.label()));
        ref.setKind(blankToNull(req.kind()));
        if (req.sortOrder() != null) ref.setSortOrder(req.sortOrder());
        return referenceRepo.save(ref);
    }

    @Transactional
    public ScoreReference updateReference(Long scoreId, Long referenceId, UpdateScoreReferenceRequest req) {
        ScoreReference ref = requireReference(scoreId, referenceId);
        if (req.url() != null) {
            String trimmed = req.url().trim();
            if (trimmed.isEmpty()) {
                throw new IllegalArgumentException("url cannot be blank");
            }
            ref.setUrl(trimmed);
        }
        if (req.label() != null) ref.setLabel(blankToNull(req.label()));
        if (req.kind() != null) ref.setKind(blankToNull(req.kind()));
        if (req.sortOrder() != null) ref.setSortOrder(req.sortOrder());
        ScoreReference saved = referenceRepo.save(ref);
        saved.getNotes().size();
        return saved;
    }

    @Transactional
    public void deleteReference(Long scoreId, Long referenceId) {
        ScoreReference ref = requireReference(scoreId, referenceId);
        referenceRepo.delete(ref);
    }

    // ---------- Recording notes ----------

    @Transactional
    public ScoreRecordingNote addRecordingNote(Long scoreId, Long recordingId, CreateNoteRequest req) {
        ScoreRecording rec = requireRecording(scoreId, recordingId);
        ScoreRecordingNote note = new ScoreRecordingNote();
        note.setRecording(rec);
        note.setBody(req.body().trim());
        if (req.sortOrder() != null) note.setSortOrder(req.sortOrder());
        return recordingNoteRepo.save(note);
    }

    @Transactional
    public ScoreRecordingNote updateRecordingNote(Long scoreId, Long recordingId, Long noteId, UpdateNoteRequest req) {
        ScoreRecordingNote note = requireRecordingNote(scoreId, recordingId, noteId);
        applyNoteUpdate(note::setBody, note::setSortOrder, req);
        return recordingNoteRepo.save(note);
    }

    @Transactional
    public void deleteRecordingNote(Long scoreId, Long recordingId, Long noteId) {
        recordingNoteRepo.delete(requireRecordingNote(scoreId, recordingId, noteId));
    }

    // ---------- Reference notes ----------

    @Transactional
    public ScoreReferenceNote addReferenceNote(Long scoreId, Long referenceId, CreateNoteRequest req) {
        ScoreReference ref = requireReference(scoreId, referenceId);
        ScoreReferenceNote note = new ScoreReferenceNote();
        note.setReference(ref);
        note.setBody(req.body().trim());
        if (req.sortOrder() != null) note.setSortOrder(req.sortOrder());
        return referenceNoteRepo.save(note);
    }

    @Transactional
    public ScoreReferenceNote updateReferenceNote(Long scoreId, Long referenceId, Long noteId, UpdateNoteRequest req) {
        ScoreReferenceNote note = requireReferenceNote(scoreId, referenceId, noteId);
        applyNoteUpdate(note::setBody, note::setSortOrder, req);
        return referenceNoteRepo.save(note);
    }

    @Transactional
    public void deleteReferenceNote(Long scoreId, Long referenceId, Long noteId) {
        referenceNoteRepo.delete(requireReferenceNote(scoreId, referenceId, noteId));
    }

    // ---------- Public streaming lookup ----------

    /**
     * Used by the public {@code GET /api/scores/{id}/recordings/{rid}} endpoint.
     * 404s for: missing score, missing recording, recording belongs to a different
     * score, or recording belongs to an unpublished score and the caller is anonymous.
     */
    @Transactional(readOnly = true)
    public ScoreRecording getRecordingForStreaming(Long scoreId, Long recordingId, boolean includeUnpublished) {
        ScoreRecording rec = requireRecording(scoreId, recordingId);
        if (!includeUnpublished && !rec.getScore().isPublished()) {
            throw new AttachmentNotFoundException("recording", recordingId);
        }
        return rec;
    }

    // ---------- Helpers ----------

    private Score requireScore(Long scoreId) {
        return scoreRepo.findById(scoreId).orElseThrow(() -> new ScoreNotFoundException(scoreId));
    }

    private ScoreRecording requireRecording(Long scoreId, Long recordingId) {
        ScoreRecording rec = recordingRepo.findById(recordingId)
                .orElseThrow(() -> new AttachmentNotFoundException("recording", recordingId));
        if (!rec.getScore().getId().equals(scoreId)) {
            throw new AttachmentNotFoundException("recording", recordingId);
        }
        return rec;
    }

    private ScoreReference requireReference(Long scoreId, Long referenceId) {
        ScoreReference ref = referenceRepo.findById(referenceId)
                .orElseThrow(() -> new AttachmentNotFoundException("reference", referenceId));
        if (!ref.getScore().getId().equals(scoreId)) {
            throw new AttachmentNotFoundException("reference", referenceId);
        }
        return ref;
    }

    private ScoreRecordingNote requireRecordingNote(Long scoreId, Long recordingId, Long noteId) {
        ScoreRecordingNote note = recordingNoteRepo.findById(noteId)
                .orElseThrow(() -> new AttachmentNotFoundException("note", noteId));
        ScoreRecording rec = note.getRecording();
        if (!rec.getId().equals(recordingId) || !rec.getScore().getId().equals(scoreId)) {
            throw new AttachmentNotFoundException("note", noteId);
        }
        return note;
    }

    private ScoreReferenceNote requireReferenceNote(Long scoreId, Long referenceId, Long noteId) {
        ScoreReferenceNote note = referenceNoteRepo.findById(noteId)
                .orElseThrow(() -> new AttachmentNotFoundException("note", noteId));
        ScoreReference ref = note.getReference();
        if (!ref.getId().equals(referenceId) || !ref.getScore().getId().equals(scoreId)) {
            throw new AttachmentNotFoundException("note", noteId);
        }
        return note;
    }

    /**
     * Shared body+sortOrder applier so the recording-note and reference-note
     * PATCH paths don't duplicate the same null-handling boilerplate.
     */
    private static void applyNoteUpdate(
            java.util.function.Consumer<String> setBody,
            java.util.function.IntConsumer setSortOrder,
            UpdateNoteRequest req) {
        if (req.body() != null) {
            String trimmed = req.body().trim();
            if (trimmed.isEmpty()) {
                throw new IllegalArgumentException("body cannot be blank");
            }
            setBody.accept(trimmed);
        }
        if (req.sortOrder() != null) {
            setSortOrder.accept(req.sortOrder());
        }
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
