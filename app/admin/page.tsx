"use client";

/**
 * app/admin/page.tsx
 *
 * Admin Dashboard — view and manage all bookings.
 *
 * Features:
 *   - Filter bookings by date and status
 *   - View booking details (customer, service, barber, date/time)
 *   - Approve / reject cancel and reschedule requests
 *   - Confirm pending bookings
 */

import { useState, useEffect, useCallback } from "react";
import { createBrowserAuthClient } from "@/lib/supabaseAuth";

// ─────────────────────────────────────────────────────────────
// Dashboard Stats types
// ─────────────────────────────────────────────────────────────

interface DashboardStats {
  bookingsToday: number;
  revenueToday: number;
  revenueThisMonth: number;
  activeBookings: number;
  cancelledBookings: number;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled" | "reschedule_requested";
  reschedule_requested: boolean;
  new_date: string | null;
  new_time: string | null;
  created_at: string;
  services: { name: string; price: number } | null;
  barbers:  { name: string } | null;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const IDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(n);

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending:              { background: "#fef9c3", color: "#854d0e" },
  confirmed:            { background: "#dcfce7", color: "#166534" },
  cancelled:            { background: "#fee2e2", color: "#991b1b" },
  reschedule_requested: { background: "#dbeafe", color: "#1e40af" },
};

const STATUS_LABEL: Record<string, string> = {
  pending:              "Pending",
  confirmed:            "Confirmed",
  cancelled:            "Cancelled",
  reschedule_requested: "Reschedule Requested",
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading,  setLoading]      = useState(true);
  const [error,    setError]        = useState<string | null>(null);
  const [actionId, setActionId]     = useState<string | null>(null); // booking being acted on

  // Dashboard stats
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [filterDate,   setFilterDate]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Auth
  const [authChecked, setAuthChecked] = useState(false);
  const supabase = createBrowserAuthClient();

  // ── Auth guard ────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = "/admin/login";
      } else {
        setAuthChecked(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  // ── Fetch bookings ─────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterDate)   params.set("date",   filterDate);
      if (filterStatus) params.set("status", filterStatus);

      const res  = await fetch(`/api/bookings?${params.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error);
      setBookings(json.data.bookings);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterStatus]);

  useEffect(() => { if (authChecked) fetchBookings(); }, [authChecked, fetchBookings]);

  // ── Fetch dashboard stats ─────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (e) {
      console.error("Failed to load dashboard stats:", e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { if (authChecked) fetchStats(); }, [authChecked, fetchStats]);


  // ── Update status ──────────────────────────────────────────
  async function updateStatus(id: string, newStatus: "confirmed" | "cancelled") {
    setActionId(id);
    try {
      const res  = await fetch(`/api/bookings/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await fetchBookings(); // refresh
    } catch (e: unknown) {
      alert((e as Error).message ?? "Action failed.");
    } finally {
      setActionId(null);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <main style={s.main}>
        <p style={s.stateText}>Checking authentication…</p>
      </main>
    );
  }

  return (
    <main style={s.main}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <h1 style={s.heading}>✂ Admin Dashboard</h1>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <a href="/admin/analytics" style={s.analyticsLink}>📊 Analytics</a>
            <button style={s.refreshBtn} onClick={() => { fetchBookings(); fetchStats(); }}>↻ Refresh</button>
            <button style={s.logoutBtn} onClick={handleLogout}>🚪 Logout</button>
          </div>
        </div>


        {/* Dashboard Summary Cards */}
        <div style={s.summaryGrid}>
          <SummaryCard
            label="Bookings Today"
            value={statsLoading ? "…" : String(stats?.bookingsToday ?? 0)}
            icon="📅"
            color="#3b82f6"
          />
          <SummaryCard
            label="Revenue Today"
            value={statsLoading ? "…" : IDR(stats?.revenueToday ?? 0)}
            icon="💰"
            color="#10b981"
          />
          <SummaryCard
            label="Revenue This Month"
            value={statsLoading ? "…" : IDR(stats?.revenueThisMonth ?? 0)}
            icon="📊"
            color="#8b5cf6"
          />
          <SummaryCard
            label="Active Bookings"
            value={statsLoading ? "…" : String(stats?.activeBookings ?? 0)}
            icon="✅"
            color="#0ea5e9"
          />
          <SummaryCard
            label="Cancelled"
            value={statsLoading ? "…" : String(stats?.cancelledBookings ?? 0)}
            icon="❌"
            color="#ef4444"
          />
        </div>

        {/* Filters */}
        <div style={s.filters}>
          <input
            type="date"
            style={s.filterInput}
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            placeholder="Filter by date"
          />
          <select
            style={s.filterInput}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="reschedule_requested">Reschedule Requested</option>
          </select>
          {(filterDate || filterStatus) && (
            <button
              style={s.clearBtn}
              onClick={() => { setFilterDate(""); setFilterStatus(""); }}
            >
              Clear
            </button>
          )}
        </div>

        {/* States */}
        {loading && <p style={s.stateText}>Loading bookings…</p>}
        {error   && <p style={{ ...s.stateText, color: "#dc2626" }}>{error}</p>}
        {!loading && !error && bookings.length === 0 && (
          <p style={s.stateText}>No bookings found.</p>
        )}

        {/* Booking list */}
        {!loading && !error && bookings.length > 0 && (
          <div style={s.list}>
            {bookings.map((b) => {
              const isBusy = actionId === b.id;
              const needsAction = b.status === "pending" || b.status === "reschedule_requested";

              return (
                <div key={b.id} style={s.card}>

                  {/* Top row: name + status badge */}
                  <div style={s.cardHeader}>
                    <div>
                      <span style={s.customerName}>{b.name}</span>
                      <span style={s.bookingId}>#{b.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <span style={{ ...s.badge, ...STATUS_STYLE[b.status] }}>
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>

                  {/* Detail grid */}
                  <div style={s.detailGrid}>
                    <Detail label="Service" value={b.services?.name ?? "—"} />
                    <Detail label="Price"   value={b.services ? IDR(b.services.price) : "—"} />
                    <Detail label="Barber"  value={b.barbers?.name ?? "—"} />
                    <Detail label="Date"    value={formatDate(b.date)} />
                    <Detail label="Time"    value={b.time.slice(0, 5)} />
                    <Detail label="Email"   value={b.email} />
                    <Detail label="Phone"   value={b.phone} />
                  </div>

                  {/* Reschedule request details */}
                  {b.reschedule_requested && b.new_date && b.new_time && (
                    <div style={s.rescheduleBox}>
                      <span style={s.rescheduleLabel}>Requested reschedule →</span>
                      <span style={s.rescheduleVal}>
                        {formatDate(b.new_date)} at {b.new_time.slice(0, 5)}
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  {needsAction && (
                    <div style={s.actions}>
                      {b.status === "pending" && (
                        <button
                          style={{ ...s.actionBtn, ...s.confirmBtn }}
                          disabled={isBusy}
                          onClick={() => updateStatus(b.id, "confirmed")}
                        >
                          {isBusy ? "…" : "✓ Confirm"}
                        </button>
                      )}

                      {b.status === "reschedule_requested" && (
                        <button
                          style={{ ...s.actionBtn, ...s.confirmBtn }}
                          disabled={isBusy}
                          onClick={() => updateStatus(b.id, "confirmed")}
                        >
                          {isBusy ? "…" : "✓ Approve Reschedule"}
                        </button>
                      )}

                      <button
                        style={{ ...s.actionBtn, ...s.cancelBtn }}
                        disabled={isBusy}
                        onClick={() => updateStatus(b.id, "cancelled")}
                      >
                        {isBusy ? "…" : "✕ Cancel"}
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Small helper components ──────────────────────────────────

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: "13px", color: "#111827" }}>{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      borderTop: `3px solid ${color}`,
      minWidth: 0,
    }}>
      <div style={{ fontSize: "22px", lineHeight: 1 }}>{icon}</div>
      <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </span>
      <span style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#f9fafb",
    padding: "40px 20px",
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  },
  container: {
    maxWidth: "900px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "14px",
    marginBottom: "28px",
  },
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#111827",
    margin: 0,
  },
  refreshBtn: {
    background: "none",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "7px 16px",
    fontSize: "13px",
    cursor: "pointer",
    color: "#374151",
  },
  analyticsLink: {
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "7px 16px",
    fontSize: "13px",
    textDecoration: "none",
    fontWeight: 600,
  },
  filters: {
    display: "flex",
    gap: "10px",
    marginBottom: "24px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  filterInput: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    background: "#fff",
    color: "#111827",
    outline: "none",
  },
  clearBtn: {
    background: "none",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    cursor: "pointer",
    color: "#6b7280",
  },
  stateText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: "15px",
    marginTop: "48px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  customerName: {
    fontWeight: 700,
    fontSize: "15px",
    color: "#111827",
    display: "block",
  },
  bookingId: {
    fontSize: "11px",
    color: "#9ca3af",
    marginTop: "2px",
    display: "block",
  },
  badge: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: "20px",
    flexShrink: 0,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "12px",
    borderTop: "1px solid #f3f4f6",
    paddingTop: "14px",
  },
  rescheduleBox: {
    background: "#eff6ff",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  rescheduleLabel: {
    color: "#3b82f6",
    fontWeight: 600,
  },
  rescheduleVal: {
    color: "#1e40af",
    fontWeight: 600,
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    borderTop: "1px solid #f3f4f6",
    paddingTop: "14px",
  },
  actionBtn: {
    border: "none",
    borderRadius: "8px",
    padding: "9px 20px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmBtn: {
    background: "#111827",
    color: "#fff",
  },
  cancelBtn: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  logoutBtn: {
    background: "none",
    border: "1px solid #ef4444",
    borderRadius: "8px",
    padding: "7px 16px",
    fontSize: "13px",
    cursor: "pointer",
    color: "#ef4444",
    fontWeight: 600,
  },
};
