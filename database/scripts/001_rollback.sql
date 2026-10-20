-- Rolls back 001_create_schema.sql (destroys ALL data in these tables).
DROP TABLE IF EXISTS match_verifications;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS report_history;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS case_updates;
DROP TABLE IF EXISTS cases;
DROP TABLE IF EXISTS pincodes;
DROP TABLE IF EXISTS officers;
DROP TABLE IF EXISTS users;
