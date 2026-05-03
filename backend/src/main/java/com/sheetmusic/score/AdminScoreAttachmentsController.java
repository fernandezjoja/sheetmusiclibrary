package com.sheetmusic.score;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;

/**
 * Admin-only granular CRUD on score attachments — recordings, references, and
 * the notes attached to each. All endpoints are gated to ROLE_ADMIN by
 * {@link com.sheetmusic.security.SecurityConfig}'s {@code /api/admin/**} matcher.
 *
 * <p>The blob (MP3 file, YouTube URL string) is immutable; metadata
 * ({@code label}, {@code sortOrder}, note {@code body}, etc.) is editable
 * via PATCH. Replacing a recording's audio = DELETE + POST.
 */
@RestController
@RequestMapping("/api/admin/scores")
public class AdminScoreAttachmentsController {

    private final ScoreAttachmentsService attachments;

    public AdminScoreAttachmentsController(ScoreAttachmentsService attachments) {
        this.attachments = attachments;
    }

    // ---------- Recordings ----------

    @PostMapping(value = "/{id}/recordings", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreRecording addRecording(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "label", required = false) String label,
            @RequestPart(value = "sortOrder", required = false) String sortOrder
    ) {
        return attachments.addRecording(id, file, label, parseInt(sortOrder));
    }

    @PatchMapping("/{id}/recordings/{rid}")
    public ScoreRecording updateRecording(
            @PathVariable Long id,
            @PathVariable Long rid,
            @RequestBody UpdateScoreRecordingRequest req
    ) {
        return attachments.updateRecording(id, rid, req);
    }

    @DeleteMapping("/{id}/recordings/{rid}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecording(@PathVariable Long id, @PathVariable Long rid) {
        attachments.deleteRecording(id, rid);
    }

    // ---------- References ----------

    @PostMapping("/{id}/references")
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreReference addReference(
            @PathVariable Long id,
            @RequestBody @Valid CreateScoreReferenceRequest req
    ) {
        return attachments.addReference(id, req);
    }

    @PatchMapping("/{id}/references/{rid}")
    public ScoreReference updateReference(
            @PathVariable Long id,
            @PathVariable Long rid,
            @RequestBody UpdateScoreReferenceRequest req
    ) {
        return attachments.updateReference(id, rid, req);
    }

    @DeleteMapping("/{id}/references/{rid}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReference(@PathVariable Long id, @PathVariable Long rid) {
        attachments.deleteReference(id, rid);
    }

    // ---------- Recording notes ----------

    @PostMapping("/{id}/recordings/{rid}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreRecordingNote addRecordingNote(
            @PathVariable Long id,
            @PathVariable Long rid,
            @RequestBody @Valid CreateNoteRequest req
    ) {
        return attachments.addRecordingNote(id, rid, req);
    }

    @PatchMapping("/{id}/recordings/{rid}/notes/{nid}")
    public ScoreRecordingNote updateRecordingNote(
            @PathVariable Long id,
            @PathVariable Long rid,
            @PathVariable Long nid,
            @RequestBody UpdateNoteRequest req
    ) {
        return attachments.updateRecordingNote(id, rid, nid, req);
    }

    @DeleteMapping("/{id}/recordings/{rid}/notes/{nid}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecordingNote(@PathVariable Long id, @PathVariable Long rid, @PathVariable Long nid) {
        attachments.deleteRecordingNote(id, rid, nid);
    }

    // ---------- Reference notes ----------

    @PostMapping("/{id}/references/{rid}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreReferenceNote addReferenceNote(
            @PathVariable Long id,
            @PathVariable Long rid,
            @RequestBody @Valid CreateNoteRequest req
    ) {
        return attachments.addReferenceNote(id, rid, req);
    }

    @PatchMapping("/{id}/references/{rid}/notes/{nid}")
    public ScoreReferenceNote updateReferenceNote(
            @PathVariable Long id,
            @PathVariable Long rid,
            @PathVariable Long nid,
            @RequestBody UpdateNoteRequest req
    ) {
        return attachments.updateReferenceNote(id, rid, nid, req);
    }

    @DeleteMapping("/{id}/references/{rid}/notes/{nid}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReferenceNote(@PathVariable Long id, @PathVariable Long rid, @PathVariable Long nid) {
        attachments.deleteReferenceNote(id, rid, nid);
    }

    private static Integer parseInt(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("sortOrder must be an integer");
        }
    }
}
