/**
 * app/services/page.tsx
 *
 * Services Page — server component.
 * Fetches services from Supabase at request time and renders ServiceCard list.
 */

import { supabase } from "@/lib/supabaseClient";
import ServiceCard, { Service } from "@/components/ServiceCard";

export const metadata = {
  title: "Our Services – Leor Barber",
  description: "Browse our barbershop services and book your appointment online.",
};

// ─────────────────────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────────────────────

async function getServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, description")
    .order("price", { ascending: true });

  if (error) {
    console.error("[ServicesPage] Failed to fetch services:", error.message);
    return [];
  }

  return data as Service[];
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <main style={styles.main}>
      {/* Page header */}
      <section style={styles.hero}>
        <h1 style={styles.heading}>Our Services</h1>
        <p style={styles.sub}>
          Choose a service below and book your appointment in seconds.
        </p>
      </section>

      {/* Services grid */}
      {services.length === 0 ? (
        <p style={styles.empty}>No services available at the moment. Check back soon.</p>
      ) : (
        <div style={styles.grid}>
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </main>
  );
}

// ─── Inline styles ────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#f9fafb",
    padding: "48px 24px",
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  },
  hero: {
    maxWidth: "680px",
    margin: "0 auto 40px",
    textAlign: "center",
  },
  heading: {
    fontSize: "32px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 8px",
  },
  sub: {
    fontSize: "16px",
    color: "#6b7280",
    margin: 0,
  },
  grid: {
    maxWidth: "680px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: "15px",
    marginTop: "40px",
  },
};
