-- IdentArchive: 002 - seed initial admin user
-- Target: MySQL 8.0.16+ (InnoDB, utf8mb4). Run against `identarchive`.
--
-- Instructions:
-- 1. Replace the placeholder values in the SET statements below with your actual admin credentials.
-- 2. The password hash MUST be generated using bcrypt (cost factor / salt rounds = 12),
--    matching the backend authentication utility (backend/src/utils/password.js).
--    You can generate a hash using Node.js:
--      node -e "require('bcryptjs').hash('YourStrongPasswordHere', 12).then(console.log)"
--    Or using Python:
--      python -c "import bcrypt; print(bcrypt.hashpw(b'YourStrongPasswordHere', bcrypt.gensalt(12)).decode())"
-- 3. Execute this script using the MySQL client:
--      mysql -u identarchive_migrate -p < database/scripts/002_seed_admin.sql
--    Alternatively, define session variables inline when executing:
--      mysql -u identarchive_migrate -p -e "SET @admin_name='Admin User'; SET @admin_email='admin@identarchive.org'; SET @admin_password_hash='<hash>'; SOURCE database/scripts/002_seed_admin.sql;"

USE identarchive;

SET NAMES utf8mb4;

-- ============================================================================
-- Configuration / Placeholders
-- Supply your desired admin credentials below or pass them as session variables.
-- ============================================================================
SET @admin_name          = COALESCE(@admin_name, 'System Administrator');
SET @admin_email         = COALESCE(@admin_email, 'admin@identarchive.org');
-- !!! SUPPLY ACTUAL BCRYPT HASH BELOW BEFORE EXECUTION !!!
SET @admin_password_hash = COALESCE(@admin_password_hash, '$2a$12$REPLACE_WITH_ACTUAL_BCRYPT_PASSWORD_HASH');
SET @admin_phone         = COALESCE(@admin_phone, NULL);

-- ============================================================================
-- Insert Admin User Record
-- ============================================================================
-- Inserts a single record into the `users` table with role='admin'.
-- Generates a 36-character UUID() for user_id and marks verified_at as CURRENT_TIMESTAMP.
INSERT INTO users (
  user_id,
  name,
  email,
  password_hash,
  role,
  phone,
  verified_at,
  created_at,
  updated_at
) VALUES (
  UUID(),
  @admin_name,
  @admin_email,
  @admin_password_hash,
  'admin',
  @admin_phone,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  name          = VALUES(name),
  password_hash = VALUES(password_hash),
  role          = 'admin',
  verified_at   = COALESCE(users.verified_at, CURRENT_TIMESTAMP),
  updated_at    = CURRENT_TIMESTAMP;
