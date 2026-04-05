"use client";

/**
 * app/page.tsx
 *
 * Landing / Dashboard Page for Leor Barber.
 *
 * Sections (tab-based):
 *   Services | Team | About | Gallery | Reviews | Address
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────
// Static content — replace with DB fetch later if needed
// ─────────────────────────────────────────────────────────────

const SERVICES = [
  { name: "Haircut",              price: "Rp 50.000",  desc: "Classic haircut tailored to your style." },
  { name: "Haircut + Beard Trim", price: "Rp 80.000",  desc: "Full grooming package." },
  { name: "Beard Trim",           price: "Rp 30.000",  desc: "Precision beard shaping." },
  { name: "Hair Coloring",        price: "Rp 150.000", desc: "Professional hair coloring." },
  { name: "Scalp Treatment",      price: "Rp 100.000", desc: "Deep cleanse & moisturizing scalp care." },
];

const TEAM = [
  { name: "Leo",    role: "Senior Barber",   exp: "8 years experience" },
  { name: "Adrian", role: "Barber",          exp: "5 years experience" },
  { name: "Rafi",   role: "Junior Barber",   exp: "2 years experience" },
];

const REVIEWS = [
  { name: "Budi S.",    rating: 5, text: "Best barbershop in town. Leo really knows what he's doing!" },
  { name: "Andi P.",    rating: 5, text: "Clean shop, friendly staff, great results every time." },
  { name: "Rizky M.",   rating: 4, text: "Fast service and affordable prices. Highly recommended." },
];

const GALLERY_COLORS = ["#1f2937","#374151","#4b5563","#6b7280","#9ca3af","#d1d5db"];

const TABS = ["Services", "Team", "About", "Gallery", "Reviews", "Address"] as const;
type Tab = typeof TABS[number];

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Services");
  const router = useRouter();

  return (
    <main style={s.main}>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          <h1 style={s.heroTitle}>✂ LEOR BARBER</h1>
          <p style={s.heroSub}>Premium grooming for the modern man.</p>
          <p style={s.heroHours}>Open daily · 10:00 – 22:00</p>
          <button style={s.heroBtn} onClick={() => router.push("/booking")}>
            Book Now
          </button>
        </div>
      </section>

      {/* ── Tab Bar ───────────────────────────────────────── */}
      <nav style={s.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab}
            style={{ ...s.tabBtn, ...(activeTab === tab ? s.tabBtnActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ───────────────────────────────────── */}
      <section style={s.content}>

        {/* Services */}
        {activeTab === "Services" && (
          <div style={s.grid}>
            {SERVICES.map((svc) => (
              <div key={svc.name} style={s.card}>
                <div style={s.cardTop}>
                  <span style={s.cardName}>{svc.name}</span>
                  <span style={s.cardPrice}>{svc.price}</span>
                </div>
                <p style={s.cardDesc}>{svc.desc}</p>
                <button style={s.bookBtn} onClick={() => router.push("/services")}>
                  Book
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Team */}
        {activeTab === "Team" && (
          <div style={s.grid}>
            {TEAM.map((member) => (
              <div key={member.name} style={{ ...s.card, alignItems: "center", textAlign: "center" }}>
                <div style={s.avatar}>{member.name[0]}</div>
                <strong style={{ fontSize: "16px", color: "#111827" }}>{member.name}</strong>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>{member.role}</span>
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>{member.exp}</span>
              </div>
            ))}
          </div>
        )}

        {/* About */}
        {activeTab === "About" && (
          <div style={s.prose}>
            <h2 style={s.proseTitle}>About Leor Barber</h2>
            <p>
              Leor Barber was founded with one mission: give every client a great haircut in a
              comfortable, welcoming environment. We combine traditional barbering techniques with
              modern styles to deliver results you&apos;ll love.
            </p>
            <p>
              Our barbers are trained professionals with years of experience. Whether you want a
              classic cut, a fresh fade, or a full grooming package, we&apos;ve got you covered.
            </p>
            <p>
              Walk-ins welcome. Online booking available daily from <strong>10:00 to 22:00</strong>.
              Payment is made at the store — no upfront payment required.
            </p>
          </div>
        )}

        {/* Gallery */}
        {activeTab === "Gallery" && (
          <div>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "16px" }}>
              Photography coming soon. Visit us to see the work in person.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {GALLERY_COLORS.map((color, i) => (
                <div
                  key={i}
                  style={{
                    height: "120px",
                    borderRadius: "8px",
                    background: color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 600,
                    opacity: 0.6,
                  }}
                >
                  Photo {i + 1}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {activeTab === "Reviews" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {REVIEWS.map((r) => (
              <div key={r.name} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#111827" }}>{r.name}</strong>
                  <span style={{ color: "#f59e0b", fontSize: "15px" }}>
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  </span>
                </div>
                <p style={{ color: "#6b7280", fontSize: "14px", margin: "8px 0 0" }}>{r.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Address */}
        {activeTab === "Address" && (
          <div style={s.prose}>
            <h2 style={s.proseTitle}>Find Us</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                ["📍", "Address",  "Jl. Contoh No. 123, Jakarta Selatan, Indonesia"],
                ["🕙", "Hours",    "Open daily: 10:00 – 22:00"],
                ["📞", "Phone",    "+62 812-3456-7890"],
                ["✉️",  "Email",   "leorbarber@example.com"],
              ].map(([icon, label, value]) => (
                <div key={label} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "18px", flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "#374151" }}>{label}</div>
                    <div style={{ fontSize: "14px", color: "#6b7280" }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Map placeholder */}
            <div style={{
              marginTop: "24px",
              height: "180px",
              borderRadius: "10px",
              background: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: "14px",
            }}>
              📍 Map embed coming soon
            </div>
          </div>
        )}

      </section>

      {/* ── Sticky Book CTA ───────────────────────────────── */}
      <div style={s.stickyBar}>
        <button style={s.stickyBtn} onClick={() => router.push("/booking")}>
          Book an Appointment
        </button>
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
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    paddingBottom: "80px", // space for sticky bar
  },
  // Hero
  hero: {
    background: "#111827",
    color: "#fff",
    padding: "64px 24px 48px",
    textAlign: "center",
  },
  heroInner: {
    maxWidth: "480px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: "34px",
    fontWeight: 800,
    margin: 0,
    letterSpacing: "2px",
  },
  heroSub: {
    fontSize: "16px",
    color: "#9ca3af",
    margin: 0,
  },
  heroHours: {
    fontSize: "13px",
    color: "#6b7280",
    margin: 0,
  },
  heroBtn: {
    marginTop: "8px",
    background: "#fff",
    color: "#111827",
    border: "none",
    borderRadius: "8px",
    padding: "12px 32px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.3px",
  },
  // Tabs
  tabBar: {
    display: "flex",
    overflowX: "auto",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 16px",
    gap: "0",
    scrollbarWidth: "none",
  },
  tabBtn: {
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "14px 16px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#6b7280",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  tabBtnActive: {
    color: "#111827",
    fontWeight: 700,
    borderBottom: "2px solid #111827",
  },
  // Content
  content: {
    maxWidth: "680px",
    margin: "28px auto",
    padding: "0 20px",
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: {
    fontWeight: 600,
    fontSize: "15px",
    color: "#111827",
  },
  cardPrice: {
    fontSize: "14px",
    color: "#4b5563",
    fontWeight: 500,
  },
  cardDesc: {
    fontSize: "13px",
    color: "#6b7280",
    margin: 0,
  },
  bookBtn: {
    alignSelf: "flex-start",
    marginTop: "4px",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "7px 18px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "#111827",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    fontWeight: 700,
    flexShrink: 0,
  },
  prose: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    fontSize: "15px",
    color: "#374151",
    lineHeight: "1.7",
  },
  proseTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 4px",
  },
  // Sticky CTA
  stickyBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    padding: "12px 20px",
  },
  stickyBtn: {
    width: "100%",
    maxWidth: "680px",
    display: "block",
    margin: "0 auto",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "13px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.3px",
  },
};
