package com.sheetmusic.storage;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {

    /** Persist {@code file} as the given {@link FileType}. Returns the relative path stored in the DB. */
    String store(MultipartFile file, FileType type);

    /** Resolve a previously-stored relative path back to a streamable resource. */
    Resource load(String relativePath);

    /** Best-effort delete of a previously-stored file. No-op if the path is null or already gone. */
    void delete(String relativePath);
}
