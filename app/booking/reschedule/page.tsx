"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Calendar from "@/components/Calendar";
import TimeSlotPicker from "@/components/TimeSlotPicker";

interface BookingDetails {
  id: string;
  date: string;
  time: string;
  status: string;
  barber_id: string;
  services: { name: string; price: number };
  barbers: { name: string };
}
interface TimeSlot { time: string; available: boolean }

export default function RescheduleBookingPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  // Auth and Current Booking States
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection States
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // 1. Fetch original booking to authorize and get barber_id
  useEffect(() => {
    async function fetchBooking() {
      if (!id || !token) {
        setError("Invalid link. Missing booking ID or token.");
        setLoadingInitial(false);
        return;
      }
      try {
        const res = await fetch(`/api/booking-details?id=${id}&token=${token}&type=reschedule`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || "Failed to load booking details.");
        } else {
          setBooking(json.data.booking);
        }
      } catch (err) {
        setError("Network error. Please try again later.");
      } finally {
        setLoadingInitial(false);
      }
    }
    fetchBooking();
  }, [id, token]);

  // 2. Fetch available slots when newDate changes
  const fetchSlots = useCallback(async (bid: string, d: string) => {
    if (!bid || !d) return;
    setLoadingSlots(true);
    setNewTime(null);
    try {
      const res = await fetch(`/api/slots?barber_id=${bid}&date=${d}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      const json = await res.json();
      if (json.success) {
        setSlots(json.data.slots);
      }
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (booking?.barber_id && newDate) {
      fetchSlots(booking.barber_id, newDate);
    }
  }, [booking?.barber_id, newDate, fetchSlots]);

  // 3. Submit Reschedule Request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newTime || !id || !token) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, token, new_date: newDate, new_time: newTime }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Failed to submit reschedule request.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Views ---
  if (loadingInitial) {
    return (
      <main style={styles.main}>
        <p style={{ color: "#9ca3af" }}>Loading reschedule request...</p>
      </main>
    );
  }

  if (success) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.heading}>Request Received</h2>
          <p style={{ color: "#4b5563", fontSize: "14px", textAlign: "center", marginBottom: "20px" }}>
            Your reschedule request for <strong>{newDate}</strong> at <strong>{newTime}</strong> has been sent to the admin.
          </p>
          <p style={{ color: "#6b7280", margin: "0 0 24px", textAlign: "center", fontSize: "13px" }}>
            We'll email you once it's approved. Your original booking remains active until then.
          </p>
          <button style={{ ...styles.submitBtn, background: "#111827" }} onClick={() => window.location.href = "/"}>
            Return Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Reschedule Appointment</h1>

        {error ? (
          <div style={styles.card}>
            <div style={styles.errorMsg}>{error}</div>
            <button style={{ ...styles.submitBtn, background: "#111827", marginTop: "20px" }} onClick={() => window.location.href = "/"}>
              Return Home
            </button>
          </div>
        ) : booking ? (
          <form style={styles.form} onSubmit={handleSubmit}>
            {/* Display current booking context */}
            <div style={styles.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: "16px", color: "#111827" }}>Current Appointment</h3>
              <p style={{ margin: "0 0 4px", fontSize: "14px", color: "#4b5563" }}>
                <strong>Barber:</strong> {booking.barbers.name} 
              </p>
              <p style={{ margin: 0, fontSize: "14px", color: "#4b5563" }}>
                <strong>Time:</strong> {booking.date} at {booking.time.slice(0, 5)}
              </p>
            </div>

            {/* Select New Date */}
            <section style={styles.section}>
              <label style={styles.label}>Select New Date</label>
              <Calendar selected={newDate} onSelect={(d) => setNewDate(d)} />
            </section>

            {/* Select New Time */}
            <section style={styles.section}>
              <label style={styles.label}>Select New Time</label>
              <TimeSlotPicker
                slots={slots}
                selected={newTime}
                loading={loadingSlots}
                onSelect={setNewTime}
              />
            </section>

            <button
              type="submit"
              disabled={submitting || !newDate || !newTime}
              style={{
                ...styles.submitBtn,
                background: "#2563eb",
                opacity: (submitting || !newDate || !newTime) ? 0.7 : 1,
                cursor: (submitting || !newDate || !newTime) ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#f9fafb",
    padding: "48px 24px",
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  container: { width: "100%", maxWidth: "600px" },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
    marginBottom: "24px",
  },
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 24px",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  errorMsg: {
    color: "#dc2626",
    fontSize: "14px",
    margin: 0,
    padding: "14px",
    background: "#fef2f2",
    borderRadius: "8px",
    border: "1px solid #fecaca",
    textAlign: "center",
  },
  submitBtn: {
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 600,
    width: "100%",
  },
  successIcon: {
    width: "56px",
    height: "56px",
    background: "#2563eb",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "24px",
    fontWeight: 700,
    margin: "0 auto 20px",
  },
};
