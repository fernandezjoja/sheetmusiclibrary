package com.sheetmusic.storage;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;

@Service
@ConditionalOnProperty(name = "app.storage.backend", havingValue = "local", matchIfMissing = true)
public class LocalDiskFileStorageService implements FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalDiskFileStorageService.class);

    private final Path root;

    public LocalDiskFileStorageService(@Value("${app.storage.root}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    @PostConstruct
    void init() {
        try {
            Files.createDirectories(root);
            for (FileType type : FileType.values()) {
                Files.createDirectories(root.resolve(type.subdir()));
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to initialize storage root at " + root, e);
        }
    }

    @Override
    public String store(MultipartFile file, FileType type) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot store empty file for type " + type);
        }
        String filename = UUID.randomUUID() + "." + type.extension();
        Path dest = root.resolve(type.subdir()).resolve(filename);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dest);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store file " + filename, e);
        }
        return type.subdir() + "/" + filename;
    }

    @Override
    public Resource load(String relativePath) {
        return new FileSystemResource(safeResolve(relativePath));
    }

    @Override
    public void delete(String relativePath) {
        if (relativePath == null) return;
        try {
            Files.deleteIfExists(safeResolve(relativePath));
        } catch (IOException e) {
            // Failing to delete an old file leaves an orphan on disk but doesn't
            // affect correctness for the user. Log-and-continue is the right call;
            // an out-of-band sweep can reconcile orphans later.
            log.warn("Failed to delete file {}: {}", relativePath, e.getMessage());
        }
    }

    private Path safeResolve(String relativePath) {
        Path resolved = root.resolve(relativePath).normalize();
        // Defense in depth: refuse anything that escapes the root, even though
        // the relative path comes from our own DB rows.
        if (!resolved.startsWith(root)) {
            throw new SecurityException("Path traversal blocked: " + relativePath);
        }
        return resolved;
    }
}
