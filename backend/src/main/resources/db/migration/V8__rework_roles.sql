-- Replace the ranked USER / COLLABORATOR / ADMIN roles with
-- CORO / PRUEBA / DEPARTAMENTO / ADMIN (see UserRole in com.sheetmusic.user).
-- The constraint is dropped first so the renamed values don't violate it.
ALTER TABLE users DROP CONSTRAINT users_role_check;

UPDATE users SET role = 'CORO' WHERE role = 'USER';
UPDATE users SET role = 'PRUEBA' WHERE role = 'COLLABORATOR';

ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('ADMIN', 'DEPARTAMENTO', 'PRUEBA', 'CORO'));
