"use client";

/**
 * app/admin/analytics/page.tsx
 *
 * Admin Analytics Page — chart visualizations for business data.
 *
 * Charts:
 *   - Revenue Over Time (Area Chart)
 *   - Bookings Per Day (Bar Chart)
 *   - Service Popularity (Bar Chart, horizontal)
 */

import { useState, useEffect, useCallback } from "react";
import { createBrowserAuthClient } from "@/lib/supabaseAuth";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface RevenuePoint  { date: string; revenue: number; }
interface BookingPoint  { date: string; count: number; }
interface ServicePoint  { name: string; count: number; }

interface ChartData {
  revenueOverTime:    RevenuePoint[];
  bookingsPerDay:     BookingPoint[];
  servicePopularity:  ServicePoint[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const IDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(n);

function shortDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [days, setDays]           = useState(30);

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

  const fetchCharts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/charts?days=${days}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.success) setChartData(json.data);
    } catch (e) {
      console.error("Failed to load chart data:", e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { if (authChecked) fetchCharts(); }, [authChecked, fetchCharts]);

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
          <div>
            <h1 style={s.heading}>📊 Analytics</h1>
            <p style={s.subheading}>Visual overview of your barbershop performance</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <a href="/admin" style={s.backLink}>← Back to Dashboard</a>
            <button style={s.logoutBtn} onClick={handleLogout}>🚪 Logout</button>
          </div>
        </div>

        {/* Range selector */}
        <div style={s.rangeBar}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              style={{
                ...s.rangeBtn,
                ...(days === d ? s.rangeBtnActive : {}),
              }}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>

        {loading && <p style={s.stateText}>Loading charts…</p>}

        {!loading && chartData && (
          <>

            {/* 1. Revenue Over Time */}
            <div style={s.chartCard}>
              <h2 style={s.chartTitle}>💰 Revenue Over Time</h2>
              <div style={s.chartWrap}>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData.revenueOverTime}>
                    <defs>
                      <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      formatter={(value: any) => [IDR(value as number), "Revenue"]}
                      labelFormatter={(label: any) => shortDate(String(label))}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#gradRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Bookings Per Day */}
            <div style={s.chartCard}>
              <h2 style={s.chartTitle}>📅 Bookings Per Day</h2>
              <div style={s.chartWrap}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData.bookingsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      formatter={(value: any) => [value, "Bookings"]}
                      labelFormatter={(label: any) => shortDate(String(label))}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Service Popularity */}
            <div style={s.chartCard}>
              <h2 style={s.chartTitle}>✂️ Most Popular Services</h2>
              <div style={s.chartWrap}>
                <ResponsiveContainer width="100%" height={Math.max(180, chartData.servicePopularity.length * 44)}>
                  <BarChart data={chartData.servicePopularity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 12, fill: "#374151" }}
                      axisLine={false}
                      tickLine={false}
                      width={140}
                    />
                    <Tooltip
                      formatter={(value: any) => [value, "Bookings"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </>
        )}

        {!loading && chartData && chartData.revenueOverTime.length === 0 && (
          <p style={s.stateText}>No booking data found for this time range.</p>
        )}

      </div>
    </main>
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
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#111827",
    margin: 0,
  },
  subheading: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: "4px 0 0 0",
  },
  backLink: {
    fontSize: "13px",
    color: "#6b7280",
    textDecoration: "none",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "7px 16px",
  },
  rangeBar: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
  },
  rangeBtn: {
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "7px 16px",
    fontSize: "13px",
    cursor: "pointer",
    color: "#374151",
    fontWeight: 500,
  },
  rangeBtnActive: {
    background: "#111827",
    color: "#fff",
    borderColor: "#111827",
  },
  stateText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: "15px",
    marginTop: "48px",
  },
  chartCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
  },
  chartTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#111827",
    margin: "0 0 16px 0",
  },
  chartWrap: {
    width: "100%",
    overflow: "hidden",
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
