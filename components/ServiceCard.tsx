"use client";

/**
 * components/ServiceCard.tsx
 *
 * Displays a single barbershop service.
 * - Shows name + price
 * - Expandable description (toggle on click)
 * - "Book Now" button → /booking?service=<id>
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Service {
  id: string;
  name: string;
  price: number;
  description: string;
}

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const formattedPrice = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(service.price);

  return (
    <div style={styles.card}>
      {/* Header row */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.name}>{service.name}</h3>
          <span style={styles.price}>{formattedPrice}</span>
        </div>

        {/* Expand toggle */}
        <button
          style={styles.toggle}
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide details" : "Show details"}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {/* Expandable description */}
      {expanded && (
        <p style={styles.description}>{service.description}</p>
      )}

      {/* Book CTA */}
      <button
        style={styles.bookBtn}
        onClick={() => router.push(`/booking?service=${service.id}`)}
      >
        Book Now
      </button>
    </div>
  );
}

// ─── Inline styles (simple, as per context.md) ───────────────
const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "20px 24px",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  name: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 600,
    color: "#111827",
  },
  price: {
    fontSize: "15px",
    color: "#4b5563",
    marginTop: "4px",
    display: "block",
  },
  toggle: {
    background: "none",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: "12px",
    color: "#6b7280",
    flexShrink: 0,
  },
  description: {
    fontSize: "14px",
    color: "#6b7280",
    lineHeight: "1.6",
    margin: 0,
    paddingTop: "4px",
    borderTop: "1px solid #f3f4f6",
  },
  bookBtn: {
    background: "#111827",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 0",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    letterSpacing: "0.3px",
  },
};
