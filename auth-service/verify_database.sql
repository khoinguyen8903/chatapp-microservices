-- SQL Script to Verify Email Verification Feature
-- Run this script to check the database state before and after verification

-- ============================================
-- 1. Check all users and their verification status
-- ============================================
SELECT 
    username,
    email,
    is_active AS "Is Active?",
    CASE 
        WHEN verification_token IS NULL THEN 'No Token (Verified or Cleared)'
        ELSE 'Token Present'
    END AS "Token Status",
    verification_token
FROM users
ORDER BY username;

-- ============================================
-- 2. Find unverified users (pending verification)
-- ============================================
SELECT 
    username,
    email,
    verification_token AS "Verification Token"
FROM users
WHERE is_active = false
  AND verification_token IS NOT NULL;

-- ============================================
-- 3. Find verified users
-- ============================================
SELECT 
    username,
    email,
    'Verified' AS status
FROM users
WHERE is_active = true
  AND verification_token IS NULL;

-- ============================================
-- 4. Check for data inconsistencies
-- ============================================
-- Users who are active but still have a token (shouldn't happen)
SELECT 
    username,
    email,
    is_active,
    verification_token,
    'ERROR: Active user with token' AS issue
FROM users
WHERE is_active = true
  AND verification_token IS NOT NULL;

-- Users who are inactive with no token (registration might have failed)
SELECT 
    username,
    email,
    is_active,
    verification_token,
    'WARNING: Inactive user without token' AS issue
FROM users
WHERE is_active = false
  AND verification_token IS NULL;

-- ============================================
-- 5. Manual test: Verify a specific user (TESTING ONLY)
-- ============================================
-- UNCOMMENT AND RUN THIS TO MANUALLY VERIFY A USER:
-- UPDATE users 
-- SET is_active = true, verification_token = null 
-- WHERE email = 'test@example.com';

-- THEN CHECK AGAIN:
-- SELECT username, email, is_active, verification_token 
-- FROM users 
-- WHERE email = 'test@example.com';

-- ============================================
-- 6. Count users by verification status
-- ============================================
SELECT 
    COUNT(*) AS total_users,
    SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) AS verified_users,
    SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) AS unverified_users
FROM users;

-- ============================================
-- 7. Recent registrations (last 24 hours)
-- ============================================
-- Assuming you have a created_at timestamp column
-- If not, you can add one: ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
-- SELECT 
--     username,
--     email,
--     is_active,
--     created_at
-- FROM users
-- WHERE created_at > NOW() - INTERVAL '24 hours'
-- ORDER BY created_at DESC;
