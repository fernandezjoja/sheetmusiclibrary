package com.sheetmusic.storage;

import org.springframework.http.MediaType;

public enum FileType {
    MUSICXML("musicxml", "musicxml", MediaType.parseMediaType("application/vnd.recordare.musicxml+xml")),
    PDF("pdf", "pdf", MediaType.APPLICATION_PDF),
    MSCZ("mscz", "mscz", MediaType.APPLICATION_OCTET_STREAM),
    RECORDING("recordings", "mp3", MediaType.parseMediaType("audio/mpeg"));

    private final String subdir;
    private final String extension;
    private final MediaType mediaType;

    FileType(String subdir, String extension, MediaType mediaType) {
        this.subdir = subdir;
        this.extension = extension;
        this.mediaType = mediaType;
    }

    public String subdir() {
        return subdir;
    }

    public String extension() {
        return extension;
    }

    public MediaType mediaType() {
        return mediaType;
    }
}
