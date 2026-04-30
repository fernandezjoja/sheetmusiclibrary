package com.sheetmusic.score;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

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

    @Transactional(readOnly = true)
    public List<Score> list() {
        return repo.findAll();
    }

    @Transactional(readOnly = true)
    public Score get(Long id) {
        return repo.findById(id).orElseThrow(() -> new ScoreNotFoundException(id));
    }

    @Transactional
    public Score create(CreateScoreRequest meta, MultipartFile musicxml, MultipartFile pdf, MultipartFile mscz) {
        // Files are written first; if the DB save throws, files orphan on disk.
        // A periodic sweep can reconcile orphans if it ever becomes a problem.
        Score score = new Score();
        score.setTitle(meta.title().trim());
        score.setComposer(meta.composer() == null ? null : meta.composer().trim());
        score.setTags(normalizeTags(meta.tags()));
        score.setMusicxmlPath(storage.store(musicxml, FileType.MUSICXML));
        score.setPdfPath(storage.store(pdf, FileType.PDF));
        if (mscz != null && !mscz.isEmpty()) {
            score.setMsczPath(storage.store(mscz, FileType.MSCZ));
        }
        return repo.save(score);
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
