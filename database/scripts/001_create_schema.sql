-- IdentArchive: 001 - create schema
-- Target: MySQL 8.0.16+ (InnoDB, utf8mb4). Run as identarchive_migrate against `identarchive`.
-- Timestamps are stored in UTC (the app pool must set time_zone = '+00:00').
-- Table order follows FK dependencies: users, officers, pincodes, cases, case_updates,
-- reports, report_history, matches, match_verifications.

SET NAMES utf8mb4;

CREATE TABLE users (
  user_id       CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('individual','officer','admin') NOT NULL DEFAULT 'individual',
  phone         VARCHAR(20)  NULL,
  verified_at   DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- name is read from users (no duplicate copy here).
CREATE TABLE officers (
  officer_id CHAR(36)     NOT NULL,
  user_id    CHAR(36)     NOT NULL,
  badge      VARCHAR(50)  NOT NULL,
  district   VARCHAR(100) NOT NULL,
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (officer_id),
  UNIQUE KEY uq_officers_user (user_id),
  UNIQUE KEY uq_officers_badge (badge),
  CONSTRAINT fk_officers_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pincodes (
  pincode  VARCHAR(10)  NOT NULL,
  city     VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  state    VARCHAR(100) NOT NULL,
  PRIMARY KEY (pincode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- seq feeds case_number (IA-YYYY-NNNN). The app inserts case_number = case_id as a
-- placeholder, then sets the final value inside the same transaction.
CREATE TABLE cases (
  case_id           CHAR(36)     NOT NULL,
  seq               BIGINT       NOT NULL AUTO_INCREMENT,
  case_number       VARCHAR(50)  NOT NULL,
  title             VARCHAR(255) NOT NULL,
  crime_type        ENUM('missing_person','unidentified_person','abduction','runaway','trafficking','other') NOT NULL,
  case_status       ENUM('open','under_review','resolved','closed') NOT NULL DEFAULT 'open',
  kind              ENUM('missing','found') NOT NULL,
  person_name       VARCHAR(255) NULL,
  age               INT          NULL,
  estimated_age     VARCHAR(50)  NULL,
  gender            ENUM('male','female','other','unknown') NOT NULL,
  event_date        DATE         NOT NULL,
  short_description VARCHAR(500) NOT NULL,
  description       TEXT         NOT NULL,
  physical_features TEXT         NULL,
  identifying_marks TEXT         NULL,
  height_cm         INT          NULL,
  city              VARCHAR(100) NOT NULL,
  district          VARCHAR(100) NOT NULL,
  state             VARCHAR(100) NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (case_id),
  UNIQUE KEY uq_cases_seq (seq),
  UNIQUE KEY uq_cases_number (case_number),
  UNIQUE KEY uq_cases_id_kind (case_id, kind),            -- target of composite FK from matches
  KEY ix_cases_status_kind (case_status, kind),
  KEY ix_cases_location (state, district, city),
  KEY ix_cases_event_date (event_date),
  FULLTEXT KEY ft_cases_search (title, short_description, description, person_name),
  CONSTRAINT ck_cases_age    CHECK (age IS NULL OR age BETWEEN 0 AND 130),
  CONSTRAINT ck_cases_height CHECK (height_cm IS NULL OR height_cm BETWEEN 20 AND 300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE case_updates (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  case_id     CHAR(36)     NOT NULL,
  update_date DATE         NOT NULL,
  note        VARCHAR(255) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_case_updates_case (case_id, update_date),
  CONSTRAINT fk_case_updates_case FOREIGN KEY (case_id) REFERENCES cases (case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- seq feeds reference_no (REF-YYYYMMDD-NNNNNN); same placeholder rule as cases.
CREATE TABLE reports (
  report_id           CHAR(36)     NOT NULL,
  seq                 BIGINT       NOT NULL AUTO_INCREMENT,
  reference_no        VARCHAR(50)  NOT NULL,
  report_type         ENUM('missing','found') NOT NULL,
  status              ENUM('submitted','under_review','info_requested','approved','rejected','closed') NOT NULL DEFAULT 'submitted',
  priority            ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  reporter_id         CHAR(36)     NOT NULL,
  reporter_name       VARCHAR(255) NOT NULL,
  reporter_phone      VARCHAR(20)  NOT NULL,
  reporter_email      VARCHAR(255) NOT NULL,
  assigned_officer_id CHAR(36)     NULL,
  case_id             CHAR(36)     NULL,
  description         TEXT         NOT NULL,
  person_name         VARCHAR(255) NULL,
  age                 INT          NULL,
  gender              ENUM('male','female','other','unknown') NOT NULL,
  height_cm           INT          NULL,
  physical_features   TEXT         NULL,
  identifying_marks   TEXT         NULL,
  event_date          DATE         NOT NULL,
  location_address    VARCHAR(255) NOT NULL,
  location_pincode    VARCHAR(10)  NOT NULL,
  location_city       VARCHAR(100) NOT NULL,
  location_district   VARCHAR(100) NOT NULL,
  location_state      VARCHAR(100) NOT NULL,
  review_note         TEXT         NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  UNIQUE KEY uq_reports_seq (seq),
  UNIQUE KEY uq_reports_reference (reference_no),
  UNIQUE KEY uq_reports_case (case_id),                  -- one case per approved report
  KEY ix_reports_status_priority (status, priority),
  KEY ix_reports_reporter (reporter_id),
  KEY ix_reports_officer (assigned_officer_id),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id)         REFERENCES users (user_id),
  CONSTRAINT fk_reports_officer  FOREIGN KEY (assigned_officer_id) REFERENCES officers (officer_id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_case     FOREIGN KEY (case_id)             REFERENCES cases (case_id) ON DELETE SET NULL,
  CONSTRAINT ck_reports_age    CHECK (age IS NULL OR age BETWEEN 0 AND 130),
  CONSTRAINT ck_reports_height CHECK (height_cm IS NULL OR height_cm BETWEEN 20 AND 300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report_history (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  report_id  CHAR(36)     NOT NULL,
  event      VARCHAR(255) NOT NULL,
  actor_id   CHAR(36)     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_report_history_report (report_id, created_at),
  KEY ix_report_history_actor (actor_id),
  CONSTRAINT fk_report_history_report FOREIGN KEY (report_id) REFERENCES reports (report_id) ON DELETE CASCADE,
  CONSTRAINT fk_report_history_actor  FOREIGN KEY (actor_id)  REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- missing_kind / found_kind are constants that, together with the composite FKs, guarantee
-- missing_case_id points at a 'missing' case and found_case_id at a 'found' case (no triggers).
CREATE TABLE matches (
  match_id         CHAR(36)     NOT NULL,
  missing_case_id  CHAR(36)     NOT NULL,
  missing_kind     ENUM('missing','found') NOT NULL DEFAULT 'missing',
  found_case_id    CHAR(36)     NOT NULL,
  found_kind       ENUM('missing','found') NOT NULL DEFAULT 'found',
  similarity_score DECIMAL(4,2) NOT NULL,
  status           ENUM('pending','confirmed','dismissed') NOT NULL DEFAULT 'pending',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id),
  UNIQUE KEY uq_match_pair (missing_case_id, found_case_id),
  KEY ix_matches_found (found_case_id),
  KEY ix_matches_status (status),
  CONSTRAINT fk_matches_missing FOREIGN KEY (missing_case_id, missing_kind) REFERENCES cases (case_id, kind) ON DELETE CASCADE,
  CONSTRAINT fk_matches_found   FOREIGN KEY (found_case_id, found_kind)     REFERENCES cases (case_id, kind) ON DELETE CASCADE,
  CONSTRAINT ck_matches_kinds CHECK (missing_kind = 'missing' AND found_kind = 'found'),
  CONSTRAINT ck_matches_score CHECK (similarity_score BETWEEN 0.00 AND 1.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE match_verifications (
  id                BIGINT   NOT NULL AUTO_INCREMENT,
  match_id          CHAR(36) NOT NULL,
  officer_id        CHAR(36) NOT NULL,
  decision          ENUM('confirmed','dismissed') NOT NULL,
  remarks           TEXT     NOT NULL,
  verification_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_match_verifications_match (match_id),
  KEY ix_match_verifications_officer (officer_id),
  CONSTRAINT fk_match_verifications_match   FOREIGN KEY (match_id)   REFERENCES matches (match_id) ON DELETE CASCADE,
  CONSTRAINT fk_match_verifications_officer FOREIGN KEY (officer_id) REFERENCES officers (officer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
