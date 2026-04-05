"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface BookingDetails {
  id: string;
  date: string;
  time: string;
  status: string;
  services: { name: string; price: number };
  barbers: { name: string };
}

export default function CancelBookingPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchBooking() {
      if (!id || !token) {
        setError("Invalid link. Missing booking ID or token.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/booking-details?id=${id}&token=${token}&type=cancel`);
        const json = await res.json();
        
        if (!res.ok || !json.success) {
          setError(json.error || "Failed to load booking details.");
        } else {
          setBooking(json.data.booking);
        }
      } catch (err) {
        setError("Network error. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchBooking();
  }, [id, token]);

  const handleCancelClick = async () => {
    if (!id || !token) return;
    
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, token }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Failed to cancel booking.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <main style={styles.main}>
        <p style={{ color: "#9ca3af" }}>Loading cancellation request...</p>
      </main>
    );
  }

  // --- Success State ---
  if (success) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.heading}>Booking Cancelled</h2>
          <p style={{ color: "#6b7280", margin: "0 0 24px", textAlign: "center", fontSize: "14px" }}>
            Your appointment has been successfully cancelled. You will receive a confirmation email shortly.
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
      <div style={styles.card}>
        <h1 style={styles.heading}>Cancel Booking</h1>
        
        {error ? (
          <div>
            <div style={styles.errorMsg}>{error}</div>
            <button style={{ ...styles.submitBtn, background: "#111827", marginTop: "20px" }} onClick={() => window.location.href = "/"}>
              Return Home
            </button>
          </div>
        ) : booking ? (
          <>
            <p style={{ color: "#4b5563", fontSize: "14px", textAlign: "center", marginBottom: "20px" }}>
              Are you sure you want to cancel the following appointment? This action cannot be undone.
            </p>
            
            <table style={styles.detailTable}>
              <tbody>
                <tr>
                  <td style={styles.tdLabel}>Service</td>
                  <td style={styles.tdValue}>{booking.services.name}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Barber</td>
                  <td style={styles.tdValue}>{booking.barbers.name}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Date</td>
                  <td style={styles.tdValue}>{new Date(booking.date).toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric"})}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Time</td>
                  <td style={styles.tdValue}>{booking.time.slice(0, 5)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button 
                style={styles.cancelBtn} 
                onClick={handleCancelClick} 
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel Booking"}
              </button>
            </div>
            <p style={{ textAlign: "center", marginTop: "16px", fontSize: "13px" }}>
              <a href="/" style={{ color: "#6b7280", textDecoration: "none" }}>No, keep my appointment</a>
            </p>
          </>
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
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "40px",
    border: "1px solid #e5e7eb",
    width: "100%",
    maxWidth: "480px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 20px",
    textAlign: "center",
  },
  detailTable: {
    width: "100%",
    background: "#f9fafb",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    borderCollapse: "collapse",
  },
  tdLabel: {
    padding: "12px 16px",
    fontSize: "13px",
    color: "#6b7280",
    borderBottom: "1px solid #e5e7eb",
    width: "40%",
  },
  tdValue: {
    padding: "12px 16px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#111827",
    borderBottom: "1px solid #e5e7eb",
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
    cursor: "pointer",
  },
  cancelBtn: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 600,
    width: "100%",
    cursor: "pointer",
  },
  successIcon: {
    width: "56px",
    height: "56px",
    background: "#16a34a",
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
