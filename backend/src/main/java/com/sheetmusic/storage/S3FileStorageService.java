package com.sheetmusic.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * S3-compatible file storage. Designed to work with Cloudflare R2 (the
 * production target — set R2_ENDPOINT_URL and use region 'auto') as well as
 * any other S3-compatible store (AWS S3, Backblaze B2, MinIO, etc.).
 *
 * <p>Object keys mirror the on-disk layout used by {@link LocalDiskFileStorageService}
 * — e.g. {@code musicxml/<uuid>.musicxml}, {@code pdf/<uuid>.pdf}. So a row
 * created with one backend continues to resolve correctly if you ever migrate
 * from local to S3 by uploading the existing files into the bucket with the
 * same keys.
 */
@Service
@ConditionalOnProperty(name = "app.storage.backend", havingValue = "s3")
public class S3FileStorageService implements FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(S3FileStorageService.class);

    private final S3Client client;
    private final String bucket;

    public S3FileStorageService(
            @Value("${app.storage.s3.bucket}") String bucket,
            @Value("${app.storage.s3.endpoint}") String endpoint,
            @Value("${app.storage.s3.access-key}") String accessKey,
            @Value("${app.storage.s3.secret-key}") String secretKey,
            @Value("${app.storage.s3.region:auto}") String region
    ) {
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException(
                    "app.storage.s3.bucket is required when app.storage.backend=s3");
        }
        if (endpoint == null || endpoint.isBlank()) {
            throw new IllegalStateException(
                    "app.storage.s3.endpoint is required when app.storage.backend=s3");
        }
        this.bucket = bucket;
        this.client = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(accessKey, secretKey)))
                .region(Region.of(region))
                // R2 (and many S3-compatible stores) require path-style addressing
                // (bucket as path segment, not subdomain).
                .forcePathStyle(true)
                .build();
        log.info("S3FileStorageService configured with bucket={} endpoint={} region={}",
                bucket, endpoint, region);
    }

    @Override
    public String store(MultipartFile file, FileType type) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot store empty file for type " + type);
        }
        String key = type.subdir() + "/" + UUID.randomUUID() + "." + type.extension();
        try {
            client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(type.mediaType().toString())
                            .build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read multipart for " + key, e);
        } catch (S3Exception e) {
            throw new RuntimeException("Failed to upload " + key + " to S3: " + e.getMessage(), e);
        }
        return key;
    }

    @Override
    public Resource load(String relativePath) {
        if (relativePath == null) {
            throw new IllegalArgumentException("relativePath is null");
        }
        try {
            ResponseInputStream<GetObjectResponse> stream = client.getObject(
                    GetObjectRequest.builder().bucket(bucket).key(relativePath).build());
            long contentLength = stream.response().contentLength();
            // InputStreamResource backed by the S3 stream. We override
            // contentLength so Spring's HTTP layer can set Content-Length and
            // serve audio/PDF with proper byte-range / progressive download.
            return new InputStreamResource(stream) {
                @Override
                public long contentLength() {
                    return contentLength;
                }
            };
        } catch (NoSuchKeyException e) {
            throw new RuntimeException("Object not found in bucket: " + relativePath, e);
        } catch (S3Exception e) {
            throw new RuntimeException("Failed to load " + relativePath + " from S3: " + e.getMessage(), e);
        }
    }

    @Override
    public void delete(String relativePath) {
        if (relativePath == null) return;
        try {
            client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(relativePath)
                    .build());
        } catch (S3Exception e) {
            // Failing to delete leaves an orphan in the bucket but doesn't
            // affect correctness. Log-and-continue mirrors the local-disk
            // backend's behavior; a sweep can reconcile orphans later.
            log.warn("Failed to delete S3 object {}: {}", relativePath, e.getMessage());
        }
    }
}
