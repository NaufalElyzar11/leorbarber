/**
 * lib/email.ts
 *
 * Email notification system for the Barbershop Booking System.
 * Uses Resend (https://resend.com) as the email delivery provider.
 *
 * All functions are server-side only.
 * Emails must only be sent AFTER a successful DB operation.
 *
 * Exported functions:
 *   - sendBookingConfirmation    → to customer after booking is created
 *   - sendAdminNotification      → to admin after new booking
 *   - sendCancelRequestEmail     → to customer with cancel link
 *   - sendRescheduleRequestEmail → to customer with reschedule link
 *   - sendAdminDecisionEmail     → to customer after admin approves/rejects
 */

import { Resend } from "resend";

// ─────────────────────────────────────────────────────────────
// Resend client
// ─────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "no-reply@novalbarber.web.id";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface BookingEmailData {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  barberName: string;
  date: string;   // "YYYY-MM-DD"
  time: string;   // "HH:MM"
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Format "YYYY-MM-DD" → "Tuesday, 1 April 2026" */
function formatDate(raw: string): string {
  return new Date(raw).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Format "HH:MM" → "10:00 AM" */
function formatTime(raw: string): string {
  const [h, m] = raw.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// ─────────────────────────────────────────────────────────────
// Shared HTML layout
// ─────────────────────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;font-size:22px;color:#ffffff;letter-spacing:1px;">✂ LEOR BARBER</h1>
              <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">${title}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Leor Barber • Payment is made at the store<br/>
                If you did not make this booking, please ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Renders a booking detail card */
function bookingCard(data: BookingEmailData): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="6" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#6b7280;width:40%;">Booking ID</td>
              <td style="font-size:13px;color:#111827;font-weight:600;">#${data.bookingId.slice(0, 8).toUpperCase()}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;">Service</td>
              <td style="font-size:13px;color:#111827;">${data.serviceName}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;">Barber</td>
              <td style="font-size:13px;color:#111827;">${data.barberName}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;">Date</td>
              <td style="font-size:13px;color:#111827;">${formatDate(data.date)}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;">Time</td>
              <td style="font-size:13px;color:#111827;">${formatTime(data.time)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/** Renders a CTA button */
function ctaButton(label: string, href: string, color = "#111827"): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td align="center">
          <a href="${href}"
            style="display:inline-block;padding:13px 32px;background:${color};color:#ffffff;
                   text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;
                   letter-spacing:0.3px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
    <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:8px;">
      Or copy this link: <span style="word-break:break-all;">${href}</span>
    </p>`;
}

// ─────────────────────────────────────────────────────────────
// 1. sendBookingConfirmation
// ─────────────────────────────────────────────────────────────

/**
 * Sent to the customer immediately after a booking is successfully created.
 * Includes booking details + cancel and reschedule action links.
 */
export async function sendBookingConfirmation(
  data: BookingEmailData,
  cancelToken: string,
  rescheduleToken: string
): Promise<EmailResult> {
  const cancelUrl = `${APP_URL}/booking/cancel?id=${data.bookingId}&token=${cancelToken}`;
  const rescheduleUrl = `${APP_URL}/booking/reschedule?id=${data.bookingId}&token=${rescheduleToken}`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">Booking Confirmed! 🎉</h2>
    <p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Hi ${data.customerName},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;">
      Your appointment has been received. Here are your booking details:
    </p>
    ${bookingCard(data)}
    <p style="font-size:13px;color:#6b7280;margin:4px 0;">
      💳 Payment is collected <strong>at the store</strong> on the day of your appointment.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
    <p style="font-size:14px;color:#374151;margin:0 0 8px;">Need to make a change?</p>
    ${ctaButton("Cancel Booking", cancelUrl, "#dc2626")}
    ${ctaButton("Reschedule Booking", rescheduleUrl, "#2563eb")}
    <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
      These links expire in 7 days.
    </p>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: data.customerEmail,
      subject: `Booking Confirmed – ${formatDate(data.date)} at ${formatTime(data.time)}`,
      html: layout("Booking Confirmation", body),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────
// 2. sendAdminNotification
// ─────────────────────────────────────────────────────────────

/**
 * Sent to the admin/shop email whenever a new booking is submitted.
 * Links to the admin dashboard.
 */
export async function sendAdminNotification(
  data: BookingEmailData,
  adminEmail: string
): Promise<EmailResult> {
  const dashboardUrl = `${APP_URL}/admin`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">New Booking Received 📋</h2>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      A new appointment has been submitted. Review it on the admin dashboard.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:20px 0;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="6" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:40%;">Customer</td>
            <td style="font-size:13px;color:#111827;">${data.customerName}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;">Email</td>
            <td style="font-size:13px;color:#111827;">${data.customerEmail}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;">Service</td>
            <td style="font-size:13px;color:#111827;">${data.serviceName}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;">Barber</td>
            <td style="font-size:13px;color:#111827;">${data.barberName}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;">Date</td>
            <td style="font-size:13px;color:#111827;">${formatDate(data.date)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;">Time</td>
            <td style="font-size:13px;color:#111827;">${formatTime(data.time)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${ctaButton("Open Admin Dashboard", dashboardUrl, "#111827")}`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: adminEmail,
      subject: `New Booking – ${data.customerName} on ${formatDate(data.date)}`,
      html: layout("New Booking Notification", body),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────
// 2A. sendAdminRescheduleNotification
// ─────────────────────────────────────────────────────────────

export async function sendAdminRescheduleNotification(
  data: BookingEmailData,
  adminEmail: string,
  newDate: string,
  newTime: string
): Promise<EmailResult> {
  const dashboardUrl = `${APP_URL}/admin`;
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">Reschedule Request 📋</h2>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      ${data.customerName} requested to reschedule their appointment.
    </p>
    <p style="font-size:14px;color:#1e40af;margin:0 0 20px;background:#eff6ff;padding:12px;border-radius:8px;">
      <strong>Requested New Slot:</strong><br/>
      ${formatDate(newDate)} at ${formatTime(newTime)}
    </p>
    ${ctaButton("Review in Dashboard", dashboardUrl, "#2563eb")}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: adminEmail,
      subject: `Reschedule Request – ${data.customerName}`,
      html: layout("Booking Reschedule Alert", body),
    });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────
// 2B. sendAdminCancelNotification
// ─────────────────────────────────────────────────────────────

export async function sendAdminCancelNotification(
  data: BookingEmailData,
  adminEmail: string
): Promise<EmailResult> {
  const dashboardUrl = `${APP_URL}/admin`;
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#dc2626">Booking Cancelled ❌</h2>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      ${data.customerName} has cancelled their appointment for ${formatDate(data.date)} at ${formatTime(data.time)}.
    </p>
    ${ctaButton("Open Dashboard", dashboardUrl, "#111827")}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: adminEmail,
      subject: `Booking Cancelled – ${data.customerName}`,
      html: layout("Booking Cancelled", body),
    });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────
// 3. sendCancelRequestEmail
// ─────────────────────────────────────────────────────────────

/**
 * Sent to the customer when they request a cancellation.
 * Provides a confirmation link that finalises the cancel via a secure token.
 */
export async function sendCancelRequestEmail(
  data: BookingEmailData,
  cancelToken: string
): Promise<EmailResult> {
  const cancelUrl = `${APP_URL}/booking/cancel?id=${data.bookingId}&token=${cancelToken}`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">Cancel Your Appointment</h2>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      Hi ${data.customerName}, you requested to cancel the following appointment:
    </p>
    ${bookingCard(data)}
    <p style="font-size:14px;color:#374151;margin:20px 0 8px;">
      Click the button below to <strong>confirm your cancellation</strong>.
      If you did not request this, simply ignore this email.
    </p>
    ${ctaButton("Confirm Cancellation", cancelUrl, "#dc2626")}
    <p style="font-size:12px;color:#9ca3af;">This link expires in 7 days.</p>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: data.customerEmail,
      subject: `Cancel Request – ${formatDate(data.date)} at ${formatTime(data.time)}`,
      html: layout("Cancellation Request", body),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────
// 4. sendRescheduleRequestEmail
// ─────────────────────────────────────────────────────────────

/**
 * Sent to the customer when they request a reschedule.
 * Provides a link where they can choose a new date/time.
 */
export async function sendRescheduleRequestEmail(
  data: BookingEmailData,
  rescheduleToken: string
): Promise<EmailResult> {
  const rescheduleUrl = `${APP_URL}/booking/reschedule?id=${data.bookingId}&token=${rescheduleToken}`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">Reschedule Your Appointment</h2>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      Hi ${data.customerName}, you requested to reschedule the following appointment:
    </p>
    ${bookingCard(data)}
    <p style="font-size:14px;color:#374151;margin:20px 0 8px;">
      Click below to select a new date and time.
      Your original booking <strong>remains active</strong> until approved by the admin.
    </p>
    ${ctaButton("Choose New Schedule", rescheduleUrl, "#2563eb")}
    <p style="font-size:12px;color:#9ca3af;">This link expires in 7 days.</p>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: data.customerEmail,
      subject: `Reschedule Request – ${formatDate(data.date)} at ${formatTime(data.time)}`,
      html: layout("Reschedule Request", body),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────
// 5. sendAdminDecisionEmail
// ─────────────────────────────────────────────────────────────

/**
 * Sent to the customer after the admin approves or rejects a
 * cancellation or reschedule request.
 *
 * @param action     "cancel" | "reschedule"
 * @param approved   true = approved, false = rejected
 * @param newDate    Only for approved reschedule — the confirmed new date
 * @param newTime    Only for approved reschedule — the confirmed new time
 */
export async function sendAdminDecisionEmail(
  data: BookingEmailData,
  action: "cancel" | "reschedule",
  approved: boolean,
  newDate?: string,
  newTime?: string
): Promise<EmailResult> {
  let subject: string;
  let heading: string;
  let message: string;
  let cardHtml = "";

  if (action === "cancel") {
    if (approved) {
      subject = "Your Booking Has Been Cancelled";
      heading = "Booking Cancelled ❌";
      message = `Hi ${data.customerName}, your appointment has been cancelled. We hope to see you again soon!`;
      cardHtml = bookingCard(data);
    } else {
      subject = "Cancellation Request Rejected";
      heading = "Cancellation Rejected ❌";
      message = `Hi ${data.customerName}, your cancellation request has been <strong>rejected</strong>. Your original appointment remains unchanged.`;
      cardHtml = bookingCard(data);
    }
  } else {
    // reschedule
    if (approved && newDate && newTime) {
      subject = "Your Reschedule Has Been Approved";
      heading = "Reschedule Approved ✅";
      message = `Hi ${data.customerName}, your reschedule request has been <strong>approved</strong>. Your new appointment details are below:`;
      cardHtml = bookingCard({ ...data, date: newDate, time: newTime });
    } else {
      subject = "Reschedule Request Rejected";
      heading = "Reschedule Rejected ❌";
      message = `Hi ${data.customerName}, your reschedule request has been <strong>rejected</strong>. Your original appointment remains unchanged.`;
      cardHtml = bookingCard(data);
    }
  }

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">${heading}</h2>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">${message}</p>
    ${cardHtml}
    <p style="font-size:13px;color:#6b7280;margin-top:20px;">
      If you have questions, reply to this email or contact us directly.
    </p>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: data.customerEmail,
      subject,
      html: layout(heading, body),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
