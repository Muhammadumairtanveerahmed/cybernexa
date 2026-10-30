-- Store the mixed audio recording for a call.
-- The file itself lives in server/uploads/calls and is served through an
-- authenticated API route, never as a public static file.

ALTER TABLE call_logs
  ADD COLUMN recording_file VARCHAR(255) NULL AFTER ended_at,
  ADD COLUMN recording_mime VARCHAR(80) NULL AFTER recording_file,
  ADD COLUMN recording_size INT UNSIGNED NULL AFTER recording_mime,
  ADD COLUMN recording_duration INT UNSIGNED NULL AFTER recording_size;
