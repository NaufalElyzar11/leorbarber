"use client";

/**
 * app/admin/login/page.tsx
 *
 * Admin login page — email + password authentication via Supabase Auth.
 * Redirects to /admin on successful login.
 */

import { useState, useEffect } from "react";
import { createBrowserAuthClient } from "@/lib/supabaseAuth";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const supabase = createBrowserAuthClient();

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        window.location.href = "/admin";
      } else {
        setChecking(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Redirect to admin dashboard
    window.location.href = "/admin";
  }

  if (checking) {
    return (
      <main style={s.main}>
        <p style={s.stateText}>Checking session…</p>
      </main>
    );
  }

  return (
    <main style={s.main}>
      <div style={s.card}>
        <div style={s.header}>
          <span style={s.icon}>🔐</span>
          <h1 style={s.heading}>Admin Login</h1>
          <p style={s.subheading}>Sign in to access the dashboard</p>
        </div>

        <form onSubmit={handleLogin} style={s.form}>
          <div style={s.fieldGroup}>
            <label htmlFor="email" style={s.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={s.input}
            />
          </div>

          <div style={s.fieldGroup}>
            <label htmlFor="password" style={s.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={s.input}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={s.button}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "40px 36px",
    maxWidth: "400px",
    width: "100%",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "28px",
  },
  icon: {
    fontSize: "36px",
    display: "block",
    marginBottom: "12px",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 6px 0",
  },
  subheading: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "18px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "#111827",
    outline: "none",
    background: "#fff",
    transition: "border-color 0.15s",
  },
  error: {
    color: "#dc2626",
    fontSize: "13px",
    margin: 0,
    padding: "8px 12px",
    background: "#fef2f2",
    borderRadius: "8px",
    border: "1px solid #fecaca",
  },
  button: {
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "12px 20px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "4px",
    transition: "opacity 0.15s",
  },
  stateText: {
    textAlign: "center" as const,
    color: "#9ca3af",
    fontSize: "15px",
  },
};
