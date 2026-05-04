-- Widen the V4 role CHECK constraint to allow the new COLLABORATOR tier
-- (between USER and ADMIN — see UserRole.rank in com.sheetmusic.user).
-- The column itself stays TEXT; only the allowed-values list grows.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('ADMIN', 'COLLABORATOR', 'USER'));
