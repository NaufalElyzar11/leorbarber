# ✂ Leor Barber — Booking System

Web-based barbershop booking system built with Next.js, Supabase, and Resend.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (PostgreSQL database)
- **Resend** (email API)
- **Tailwind CSS** (optional — currently using inline styles)
- **Vercel** (deployment)

---

## Quick Start

### 1. Initialize the project

```bash
cd "c:\Users\User\Documents\Coolyeah\Project\Leorbarber"
npx create-next-app@latest . --typescript --app --no-tailwind --no-eslint --src-dir=false --import-alias="@/*"
```

> When prompted to overwrite existing files, choose **No** to keep the code already written.

### 2. Install dependencies

```bash
npm install @supabase/supabase-js resend
```

### 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Your verified sender email |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (local) |
| `ADMIN_EMAIL` | Email to receive admin notifications |

### 4. Set up Supabase database

1. Go to [supabase.com](https://supabase.com) → your project
2. Open **SQL Editor**
3. Paste and run the contents of `supabase/schema.sql`

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Pages

| URL | Description |
|---|---|
| `/` | Landing page with tabs (Services, Team, About, Gallery, Reviews, Address) |
| `/services` | Browse services → click to book |
| `/booking` | Booking form (select barber, date, time, fill details) |
| `/admin` | Admin dashboard — view and manage bookings |

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/booking` | Create a new booking |
| `GET` | `/api/bookings` | List all bookings (supports `?status=`, `?date=`, `?barber_id=`) |
| `PATCH` | `/api/bookings/:id` | Update booking status (admin: confirm/cancel) |
| `POST` | `/api/cancel` | Cancel a booking via email token |
| `POST` | `/api/reschedule` | Request a reschedule via email token |
| `GET` | `/api/slots` | Get available time slots (`?barber_id=&date=`) |
| `GET` | `/api/services` | List all services |
| `GET` | `/api/barbers` | List all barbers |

---

## Booking Flow

```
Customer visits /services
  → Clicks "Book" on a service
  → Selects barber, date, available time slot
  → Fills in name, email, phone
  → Submits → confirmation email sent
  → Admin notified

Customer clicks cancel link in email
  → POST /api/cancel (token validated)
  → Booking cancelled, admin notified

Customer clicks reschedule link in email
  → POST /api/reschedule (token validated)
  → Booking status = reschedule_requested
  → Admin approves via PATCH /api/bookings/:id
```

---

## Project Structure

```
├── app/
│   ├── page.tsx                  # Landing page
│   ├── services/page.tsx         # Services list
│   ├── booking/page.tsx          # Booking form
│   ├── admin/page.tsx            # Admin dashboard
│   └── api/
│       ├── booking/route.ts
│       ├── bookings/route.ts
│       ├── bookings/[id]/route.ts
│       ├── cancel/route.ts
│       ├── reschedule/route.ts
│       ├── slots/route.ts
│       ├── services/route.ts
│       └── barbers/route.ts
├── components/
│   ├── ServiceCard.tsx
│   ├── Calendar.tsx
│   └── TimeSlotPicker.tsx
├── lib/
│   ├── supabaseClient.ts
│   ├── bookingLogic.ts
│   ├── timeSlot.ts
│   ├── email.ts
│   └── token.ts
├── supabase/
│   └── schema.sql
└── ai/
    └── context.md
```

---

## Deployment

See [`deployment_guide.md`](../brain/6b067289-60cd-4489-9299-1d3fdf080bdb/deployment_guide.md) for full Vercel deployment steps.

```bash
npm install -g vercel
vercel --prod
```
