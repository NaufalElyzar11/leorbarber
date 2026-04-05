"use client";

/**
 * app/booking/page.tsx
 *
 * Booking Page — full booking flow.
 *
 * Steps:
 *   1. Pre-selects service from ?service=<id> query param
 *   2. User selects barber, date, time
 *   3. User enters name, email, phone
 *   4. Submit → POST /api/booking
 *   5. Shows success message on completion
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Calendar from "@/components/Calendar";
import TimeSlotPicker from "@/components/TimeSlotPicker";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Service  { id: string; name: string; price: number }
interface Barber   { id: string; name: string }
interface TimeSlot { time: string; available: boolean }

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const IDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function BookingPage() {
  const searchParams = useSearchParams();
  const preselectedService = searchParams.get("service");

  // ── Data ──────────────────────────────────────────────────
  const [services, setServices] = useState<Service[]>([]);
  const [barbers,  setBarbers]  = useState<Barber[]>([]);
  const [slots,    setSlots]    = useState<TimeSlot[]>([]);

  // ── Selections ────────────────────────────────────────────
  const [serviceId, setServiceId] = useState<string>("");
  const [barberId,  setBarberId]  = useState<string>("");
  const [date,      setDate]      = useState<string | null>(null);
  const [time,      setTime]      = useState<string | null>(null);

  // ── Form fields ───────────────────────────────────────────
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (val.length > 0 && !val.includes("@")) {
      setEmailError("Email tidak valid (harus mengandung @)");
    } else {
      setEmailError(null);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.startsWith("08")) {
      val = "+628" + val.slice(2);
    }
    setPhone(val);
  };

  // ── UI state ──────────────────────────────────────────────
  const [loadingData,  setLoadingData]  = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch services + barbers on mount ─────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [sRes, bRes] = await Promise.all([
          fetch("/api/services"),
          fetch("/api/barbers"),
        ]);
        const sData = await sRes.json();
        const bData = await bRes.json();

        if (sData.success) {
          setServices(sData.data.services);
          const sid = preselectedService ?? sData.data.services[0]?.id ?? "";
          setServiceId(sid);
        }
        if (bData.success) {
          setBarbers(bData.data.barbers);
          setBarberId(bData.data.barbers[0]?.id ?? "");
        }
      } catch {
        setError("Failed to load booking options. Please refresh the page.");
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, [preselectedService]);

  // ── Fetch slots (initial + silent poll) ──────────────────
  const fetchSlots = useCallback(async (bid: string, d: string, silent = false) => {
    if (!bid || !d) return;
    if (!silent) { setLoadingSlots(true); setTime(null); }
    try {
      const res  = await fetch(`/api/slots?barber_id=${bid}&date=${d}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      const json = await res.json();
      if (json.success) {
        setSlots(json.data.slots);
        setLastUpdated(new Date());
      }
    } catch {
      if (!silent) setSlots([]);
    } finally {
      if (!silent) setLoadingSlots(false);
    }
  }, []);

  // Initial fetch on barber/date change
  useEffect(() => {
    if (barberId && date) fetchSlots(barberId, date, false);
  }, [barberId, date, fetchSlots]);

  // Real-time polling — silently refresh every 30 seconds
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (barberId && date) {
      pollRef.current = setInterval(() => {
        fetchSlots(barberId, date, true);
      }, 30_000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [barberId, date, fetchSlots]);

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!date)    return setError("Please select a date.");
    if (!time)    return setError("Please select a time slot.");
    if (!barberId) return setError("Please select a barber.");
    if (emailError || !email.includes("@")) return setError("Please provide a valid email address.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, service_id: serviceId, barber_id: barberId, date, time }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "Booking failed. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ────────────────────────────────────────
  if (success) {
    return (
      <main style={styles.main}>
        <div style={{ ...styles.card, textAlign: "center", maxWidth: "480px" }}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "22px", color: "#111827" }}>Booking Confirmed!</h2>
          <p style={{ color: "#6b7280", fontSize: "15px", margin: "0 0 24px" }}>
            A confirmation email has been sent to <strong>{email}</strong> with your booking details and links to cancel or reschedule.
          </p>
          <button style={styles.submitBtn} onClick={() => window.location.href = "/services"}>
            Back to Services
          </button>
        </div>
      </main>
    );
  }

  // ── Loading ───────────────────────────────────────────────
  if (loadingData) {
    return (
      <main style={styles.main}>
        <p style={{ textAlign: "center", color: "#9ca3af", marginTop: "80px" }}>Loading…</p>
      </main>
    );
  }

  // ── Booking form ──────────────────────────────────────────
  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Book an Appointment</h1>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>

          {/* ── Service selector ── */}
          <section style={styles.section}>
            <label style={styles.label}>Service</label>
            <select
              style={styles.select}
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              required
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {IDR(s.price)}
                </option>
              ))}
            </select>
          </section>

          {/* ── Barber selector ── */}
          <section style={styles.section}>
            <label style={styles.label}>Barber</label>
            <select
              style={styles.select}
              value={barberId}
              onChange={(e) => { setBarberId(e.target.value); setTime(null); }}
              required
            >
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </section>

          {/* ── Date picker ── */}
          <section style={styles.section}>
            <label style={styles.label}>Date</label>
            <Calendar selected={date} onSelect={(d) => setDate(d)} />
          </section>

          {/* ── Time slot picker ── */}
          <section style={styles.section}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <label style={styles.label}>
                Time {date && <span style={styles.selectedMeta}>— {date}</span>}
              </label>
              {barberId && date && (
                <span style={styles.liveBadge}>● LIVE</span>
              )}
              {lastUpdated && (
                <span style={styles.lastUpdated}>
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <TimeSlotPicker
              slots={slots}
              selected={time}
              loading={loadingSlots}
              onSelect={setTime}
            />
          </section>

          {/* ── Customer details ── */}
          <section style={styles.section}>
            <label style={styles.label}>Your Details</label>
            <div style={styles.fieldGroup}>
              <input
                style={styles.input}
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
              <input
                style={{ ...styles.input, borderColor: emailError ? "#dc2626" : "#d1d5db" }}
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={handleEmailChange}
                required
              />
              {emailError && <span style={{ color: "#dc2626", fontSize: "12px", marginTop: "-6px" }}>{emailError}</span>}
              <input
                style={styles.input}
                type="tel"
                placeholder="Phone Number (e.g. +628...)"
                value={phone}
                onChange={handlePhoneChange}
                required
              />
            </div>
          </section>

          {/* ── Error message ── */}
          {error && <p style={styles.errorMsg}>{error}</p>}

          {/* ── Submit ── */}
          <button
            type="submit"
            style={{
              ...styles.submitBtn,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Confirm Booking"}
          </button>

          <p style={styles.payNote}>💳 Payment is collected at the store on the day of your appointment.</p>
        </form>
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
  container: {
    width: "100%",
    maxWidth: "600px",
  },
  heading: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 28px",
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
  selectedMeta: {
    fontWeight: 400,
    color: "#9ca3af",
    textTransform: "none",
  },
  select: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "14px",
    background: "#fff",
    color: "#111827",
    outline: "none",
    width: "100%",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "#111827",
    outline: "none",
    background: "#fff",
    width: "100%",
    boxSizing: "border-box",
  },
  errorMsg: {
    color: "#dc2626",
    fontSize: "14px",
    margin: 0,
    padding: "10px 14px",
    background: "#fef2f2",
    borderRadius: "8px",
    border: "1px solid #fecaca",
  },
  submitBtn: {
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 600,
    width: "100%",
    cursor: "pointer",
    letterSpacing: "0.3px",
  },
  payNote: {
    color: "#9ca3af",
    fontSize: "13px",
    textAlign: "center",
    margin: 0,
  },
  liveBadge: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#16a34a",
    background: "#dcfce7",
    borderRadius: "20px",
    padding: "2px 8px",
    letterSpacing: "0.5px",
  },
  lastUpdated: {
    fontSize: "11px",
    color: "#9ca3af",
    marginLeft: "auto",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "48px 36px",
    border: "1px solid #e5e7eb",
    margin: "0 auto",
  },
  successIcon: {
    width: "56px",
    height: "56px",
    background: "#111827",
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
