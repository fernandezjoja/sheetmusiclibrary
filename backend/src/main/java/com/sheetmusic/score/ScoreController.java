package com.sheetmusic.score;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sheetmusic.security.Permissions;
import com.sheetmusic.storage.FileStorageService;
import com.sheetmusic.storage.FileType;

@RestController
@RequestMapping("/api/scores")
public class ScoreController {

    /** Cap a single Range response to 1 MiB to keep memory bounded for large files. */
    private static final long MAX_CHUNK_SIZE = 1024L * 1024L;

    private final ScoreService scores;
    private final ScoreAttachmentsService attachments;
    private final FileStorageService storage;

    public ScoreController(ScoreService scores, ScoreAttachmentsService attachments, FileStorageService storage) {
        this.scores = scores;
        this.attachments = attachments;
        this.storage = storage;
    }

    @GetMapping
    public List<ScoreListItem> list() {
        return scores.listSlim(currentPerms());
    }

    @GetMapping("/{id}")
    public ScoreView get(@PathVariable Long id) {
        Permissions perms = currentPerms();
        return ScoreView.from(scores.get(id, perms.canSeeUnpublished()), perms);
    }

    @GetMapping("/{id}/musicxml")
    public ResponseEntity<Resource> getMusicxml(@PathVariable Long id) {
        return streamFile(scores.get(id, currentPerms().canSeeUnpublished()).getMusicxmlPath(), FileType.MUSICXML);
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<Resource> getPdf(@PathVariable Long id) {
        return streamFile(scores.get(id, currentPerms().canSeeUnpublished()).getPdfPath(), FileType.PDF);
    }

    /**
     * Streams the .mscz archive. The COLLABORATOR/ADMIN role gate lives in
     * {@link com.sheetmusic.security.SecurityConfig} (matcher-level), so this
     * method only runs for an authorized caller. The published-or-not 404
     * still applies — anonymous never reaches here, but a logged-in
     * COLLABORATOR/ADMIN gets the same visibility rules as PDF/MusicXML.
     */
    @GetMapping("/{id}/mscz")
    public ResponseEntity<Resource> getMscz(@PathVariable Long id) {
        return streamFile(scores.get(id, currentPerms().canSeeUnpublished()).getMsczPath(), FileType.MSCZ);
    }

    /**
     * Streams an MP3 recording with byte-range support so {@code <audio>} players
     * can seek. 404 (via {@link AttachmentNotFoundException}) for any of:
     * unknown recording id, recording belongs to a different score, or recording
     * belongs to an unpublished score and the caller is anonymous — same response
     * shape across all three so existence isn't leaked.
     */
    @GetMapping("/{id}/recordings/{rid}")
    public ResponseEntity<ResourceRegion> getRecording(
            @PathVariable Long id,
            @PathVariable Long rid,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader
    ) {
        ScoreRecording rec = attachments.getRecordingForStreaming(id, rid, currentPerms().canSeeUnpublished());
        Resource resource = storage.load(rec.getPath());
        long contentLength;
        try {
            contentLength = resource.contentLength();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(FileType.RECORDING.mediaType());
        headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");
        String filename = rec.getOriginalFilename() != null ? rec.getOriginalFilename() : "recording.mp3";
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename.replace("\"", "") + "\"");

        if (rangeHeader != null) {
            List<HttpRange> ranges = HttpRange.parseRanges(rangeHeader);
            if (!ranges.isEmpty()) {
                HttpRange range = ranges.get(0);
                long start = range.getRangeStart(contentLength);
                long end = range.getRangeEnd(contentLength);
                long len = Math.min(MAX_CHUNK_SIZE, end - start + 1);
                ResourceRegion region = new ResourceRegion(resource, start, len);
                return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).headers(headers).body(region);
            }
        }

        return ResponseEntity.ok().headers(headers).body(new ResourceRegion(resource, 0, contentLength));
    }

    private ResponseEntity<Resource> streamFile(String path, FileType type) {
        if (path == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(type.mediaType())
                .body(storage.load(path));
    }

    private static Permissions currentPerms() {
        return Permissions.from(SecurityContextHolder.getContext().getAuthentication());
    }
}
