ALTER TABLE scores
    ADD COLUMN published BOOLEAN NOT NULL DEFAULT false;

-- Anonymous browsing always filters by `published = true`; this index keeps
-- that query cheap as the library grows.
CREATE INDEX idx_scores_published ON scores (published);
