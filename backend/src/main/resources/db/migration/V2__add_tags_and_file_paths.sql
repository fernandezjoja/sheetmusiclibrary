ALTER TABLE scores ADD COLUMN tags          TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE scores ADD COLUMN musicxml_path TEXT;
ALTER TABLE scores ADD COLUMN pdf_path      TEXT;
ALTER TABLE scores ADD COLUMN mscz_path     TEXT;

CREATE INDEX idx_scores_tags ON scores USING GIN (tags);
