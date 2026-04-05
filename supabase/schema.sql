-- ============================================================
-- Barbershop Booking System - Supabase PostgreSQL Schema
-- Production-ready schema with constraints, indexes, and RLS
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: services
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  price       INTEGER     NOT NULL CHECK (price >= 0),
  description TEXT        NOT NULL DEFAULT '',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);

-- ============================================================
-- TABLE: barbers
-- ============================================================
CREATE TABLE IF NOT EXISTS barbers (
  id                   UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT  NOT NULL,
  working_hours_start  TIME     NOT NULL DEFAULT '10:00:00',
  working_hours_end    TIME     NOT NULL DEFAULT '22:00:00',
  is_active            BOOLEAN  NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_working_hours CHECK (working_hours_start < working_hours_end)
);

-- ============================================================
-- TABLE: bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  phone                 TEXT        NOT NULL,
  service_id            UUID        NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  barber_id             UUID        NOT NULL REFERENCES barbers(id)  ON DELETE RESTRICT,
  date                  DATE        NOT NULL,
  time                  TIME        NOT NULL,
  service_price         INTEGER     NOT NULL DEFAULT 0 CHECK (service_price >= 0),
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'cancelled', 'reschedule_requested')),
  reschedule_requested  BOOLEAN     NOT NULL DEFAULT FALSE,
  new_date              DATE        NULL,
  new_time              TIME        NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent double booking: same barber cannot have two bookings at the same date+time
  CONSTRAINT uq_booking_slot UNIQUE (barber_id, date, time)
);

-- Index for fast slot availability queries
CREATE INDEX IF NOT EXISTS idx_bookings_date_time
  ON bookings (date, time);

-- Index for per-barber slot lookups
CREATE INDEX IF NOT EXISTS idx_bookings_barber_date
  ON bookings (barber_id, date);

-- Index for per-user booking lookup
CREATE INDEX IF NOT EXISTS idx_bookings_email
  ON bookings (email);

-- ============================================================
-- TABLE: schedule_blocks
-- Used by admins to manually block specific dates or times
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   UUID        NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  time        TIME        NULL,  -- if NULL, the entire date is blocked
  reason      TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_barber_date
  ON schedule_blocks (barber_id, date);

-- ============================================================
-- TABLE: booking_tokens
-- Used to generate secure cancel/reschedule links sent via email
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,
  type        TEXT        NOT NULL CHECK (type IN ('cancel', 'reschedule')),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Index for fast token lookup (used on every email link click)
CREATE INDEX IF NOT EXISTS idx_booking_tokens_token
  ON booking_tokens (token);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_booking_tokens_expires_at
  ON booking_tokens (expires_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Supabase best practice: enable RLS and lock down tables
-- ============================================================
ALTER TABLE services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_tokens  ENABLE ROW LEVEL SECURITY;

-- Allow public read access to services and barbers (needed for booking page)
CREATE POLICY "Public read services"
  ON services FOR SELECT USING (true);

CREATE POLICY "Public read barbers"
  ON barbers FOR SELECT USING (true);

-- Allow anyone to insert a booking (public booking form)
CREATE POLICY "Public insert booking"
  ON bookings FOR SELECT USING (true);

CREATE POLICY "Allow insert booking"
  ON bookings FOR INSERT WITH CHECK (true);

-- Allow token-based access for cancel/reschedule actions (via API route, service role)
-- Actual protection is done server-side via API; tokens are validated in Next.js routes.
CREATE POLICY "Service role full access bookings"
  ON bookings USING (true);

CREATE POLICY "Service role full access tokens"
  ON booking_tokens USING (true);

CREATE POLICY "Service role full access schedule_blocks"
  ON schedule_blocks USING (true);

-- ============================================================
-- SEED DATA (optional – remove in production)
-- ============================================================

-- Sample services
INSERT INTO services (name, price, description) VALUES
  ('Haircut',              50000,  'Classic haircut tailored to your style.'),
  ('Haircut + Beard Trim', 80000,  'Full grooming package with a haircut and beard trim.'),
  ('Beard Trim',           30000,  'Precision beard shaping and trimming.'),
  ('Hair Coloring',        150000, 'Professional hair coloring service.'),
  ('Scalp Treatment',      100000, 'Deep cleanse and moisturizing scalp care.');

-- Sample barbers (working 10:00—22:00)
INSERT INTO barbers (name, working_hours_start, working_hours_end) VALUES
  ('Leo',    '10:00', '22:00'),
  ('Adrian', '10:00', '22:00'),
  ('Rafi',   '10:00', '22:00');

-- ============================================================
-- SQL QUERIES
-- ============================================================

-- ------------------------------------------------------------
-- 1. INSERT BOOKING
-- Call from Next.js API route after validating slot availability.
-- Returns the new booking row.
-- ------------------------------------------------------------
-- INSERT INTO bookings (
--   name, email, phone,
--   service_id, barber_id,
--   date, time, service_price
-- )
-- VALUES (
--   $1, $2, $3,
--   $4, $5,
--   $6, $7, $8
-- )
-- RETURNING *;

-- ------------------------------------------------------------
-- 2. CHECK SLOT AVAILABILITY
-- Returns TRUE if the slot is available (no active booking exists).
-- Active booking = status NOT IN ('cancelled').
-- Use this BEFORE inserting to give a user-friendly error.
-- ------------------------------------------------------------
-- SELECT NOT EXISTS (
--   SELECT 1
--   FROM   bookings
--   WHERE  barber_id = $1      -- UUID
--     AND  date      = $2      -- DATE  e.g. '2026-04-01'
--     AND  time      = $3      -- TIME  e.g. '14:00:00'
--     AND  status   <> 'cancelled'
-- ) AS is_available;

-- ------------------------------------------------------------
-- 3. REQUEST RESCHEDULE
-- User clicks reschedule link → API validates token → runs this.
-- ------------------------------------------------------------
-- UPDATE bookings
-- SET
--   status               = 'reschedule_requested',
--   reschedule_requested = TRUE,
--   new_date             = $1,   -- requested new DATE
--   new_time             = $2    -- requested new TIME
-- WHERE id = $3                  -- booking UUID
-- RETURNING *;

-- ------------------------------------------------------------
-- 4. CANCEL BOOKING
-- User clicks cancel link → API validates token → runs this.
-- ------------------------------------------------------------
-- UPDATE bookings
-- SET status = 'cancelled'
-- WHERE id = $1   -- booking UUID
-- RETURNING *;

-- ------------------------------------------------------------
-- 5. CONFIRM RESCHEDULE (Admin approves reschedule)
-- Moves new_date/new_time to date/time and resets status.
-- ------------------------------------------------------------
-- UPDATE bookings
-- SET
--   status               = 'confirmed',
--   reschedule_requested = FALSE,
--   date                 = new_date,
--   time                 = new_time,
--   new_date             = NULL,
--   new_time             = NULL
-- WHERE id = $1
-- RETURNING *;

-- ------------------------------------------------------------
-- 6. GET ALL BOOKED SLOTS FOR A BARBER ON A DATE
-- Used to render unavailable time slots on the booking calendar.
-- ------------------------------------------------------------
-- SELECT time
-- FROM   bookings
-- WHERE  barber_id = $1
--   AND  date      = $2
--   AND  status   <> 'cancelled';

-- ------------------------------------------------------------
-- 7. INSERT BOOKING TOKEN
-- Called after booking is created; token sent inside email link.
-- ------------------------------------------------------------
-- INSERT INTO booking_tokens (booking_id, token, type, expires_at)
-- VALUES (
--   $1,                           -- booking UUID
--   $2,                           -- secure random token (generate in app)
--   $3,                           -- 'cancel' | 'reschedule'
--   NOW() + INTERVAL '7 days'     -- token valid for 7 days
-- )
-- RETURNING *;

-- ------------------------------------------------------------
-- 8. VALIDATE TOKEN (used in API route for cancel/reschedule)
-- ------------------------------------------------------------
-- SELECT bt.*, b.*
-- FROM   booking_tokens bt
-- JOIN   bookings b ON b.id = bt.booking_id
-- WHERE  bt.token      = $1
--   AND  bt.type       = $2        -- 'cancel' | 'reschedule'
--   AND  bt.expires_at > NOW()
-- LIMIT 1;

-- ------------------------------------------------------------
-- 9. DELETE EXPIRED TOKENS (run periodically via cron or trigger)
-- ------------------------------------------------------------
-- DELETE FROM booking_tokens
-- WHERE expires_at < NOW();
