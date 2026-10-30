-- TechNexa database bootstrap.
--
-- The authoritative schema lives in server/database/migrations/*.sql.
-- Run `npm run db:migrate` to apply all migrations in order.
--
-- This file only creates the bookkeeping table used by the migration runner,
-- so a fresh MySQL instance can be initialised safely.

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename VARCHAR(255) PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
