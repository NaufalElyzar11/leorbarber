-- ============================================================
-- Admin Protection — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- ============================================================
-- TABLE: admins
-- Maps Supabase Auth user IDs to admin privileges.
-- Used by the API route auth guard (requireAdmin) to verify
-- that an authenticated user has admin access.
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE,  -- References auth.users(id)
  email      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS — only service role can access this table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access admins"
  ON admins USING (true);

-- ============================================================
-- INSERT ADMIN USER
-- ============================================================
-- After creating the admin user in Supabase Auth → Users:
--   1. Go to Authentication → Users in your Supabase Dashboard
--   2. Click "Add User" → enter email + password
--   3. Copy the user's UUID from the users list
--   4. Replace <AUTH_USER_UUID> below and run this INSERT
--
-- Example:
-- INSERT INTO admins (user_id, email)
-- VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'jornojovanna01@gmail.com');
