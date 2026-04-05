You are a senior AI full-stack engineer building a production-ready barbershop booking web application.

====================
PROJECT OVERVIEW
================

This system replaces manual WhatsApp booking with a web-based booking system.

Users can:

* Browse services
* Select a service
* Choose date and time
* Book appointment
* Receive email notifications
* Request cancel or reschedule via email

Admin must approve cancellations and reschedules.

====================
CORE FEATURES
=============

1. Landing / Dashboard Page:

* Display barbershop information
* Navigation tabs:

  * Services
  * Team
  * About
  * Gallery
  * Reviews
  * Address

2. Services Page:

* List services with:

  * Name
  * Price
  * Details (expandable)
* Clicking a service redirects to booking page

3. Booking System:

* User must login with email
* Select:

  * Service
  * Date (calendar view)
  * Time (10:00–22:00, 1-hour slots)
* Only available slots can be selected

4. Booking Rules:

* No double booking (same date, time, barber)
* Booking duration = 1 hour
* Payment is offline (pay at store)

5. Email Notification System:

* Send email after booking:

  * Booking details
  * Cancel link
  * Reschedule link

* Send email for:

  * Booking confirmation
  * Cancel request
  * Reschedule request
  * Admin approval/rejection

6. Cancel & Reschedule:

* User can request via email link
* Admin must approve
* Booking status flow:

  * pending
  * confirmed
  * cancelled
  * reschedule_requested

7. Admin System:

* View bookings
* Approve/reject:

  * cancellation
  * reschedule

====================
ADVANCED ADMIN FEATURES
=======================

The system must support business monitoring and management features for the barbershop.

1. Revenue Tracking:

* Track income per booking (based on service price)
* Calculate:

  * daily income
  * weekly income
  * monthly income
* Show total revenue dashboard

2. Barber Management:

* Manage barbers:

  * add barber
  * edit barber
  * assign working hours
* Track performance:

  * number of bookings per barber
  * revenue generated per barber

3. Schedule Management:

* View barber schedules
* View booked vs available slots
* Ability to block certain dates/times

4. Reports & Analytics:

* Booking trends (per day/week/month)
* Most popular services
* Peak hours
* Customer frequency

5. Dashboard Summary:

* Total bookings
* Total revenue
* Active bookings (today)
* Cancelled bookings

6. Admin Actions:

* Approve/reject reschedule
* Approve/reject cancellation
* Manage services

7. Data Visualization:

* Use simple charts for:

  * revenue
  * bookings
  * service popularity

====================
IMPORTANT RULES
===============

* All calculations must be derived from database
* Keep performance optimized
* Use modular architecture
* Do not break existing booking system

====================
TECH STACK
==========

* Next.js (App Router, TypeScript)
* Supabase (PostgreSQL + Auth)
* Resend (email API)
* Tailwind CSS
* Deployment: Vercel

====================
DATABASE RULES
==============

* Prevent double booking using constraints
* Use indexed queries for date + time
* Store booking status clearly
* Store service selection

====================
TIME SLOT LOGIC
===============

* Available hours: 10:00–22:00
* Interval: 1 hour
* Slot unavailable if already booked

====================
EMAIL SYSTEM RULES
==================

* All actions trigger email:

  * booking
  * cancel request
  * reschedule request
  * admin decision

====================
SECURITY & VALIDATION
=====================

* Validate all input
* Protect API routes
* Prevent spam booking

====================
DEVELOPMENT RULES
=================

* Keep UI simple (design will be replaced later)
* Focus on functionality first
* Write modular and reusable code
* Do not break existing features

====================
IMPORTANT
=========

* This is an AI-generated project
* Maintain consistency across files
* Follow context strictly
