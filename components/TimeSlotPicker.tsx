"use client";

/**
 * components/TimeSlotPicker.tsx
 *
 * Renders a grid of time slots for a selected date.
 * - Available slots are clickable
 * - Unavailable slots are greyed out and disabled
 * - Selected slot is highlighted
 * - Shows loading skeleton while fetching
 */

interface TimeSlot {
  time: string;      // "HH:MM"
  available: boolean;
}

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selected: string | null;
  loading: boolean;
  onSelect: (time: string) => void;
}

export default function TimeSlotPicker({
  slots,
  selected,
  loading,
  onSelect,
}: TimeSlotPickerProps) {
  if (loading) {
    return (
      <div style={styles.grid}>
        {Array(12).fill(null).map((_, i) => (
          <div key={i} style={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p style={styles.empty}>Select a date to see available time slots.</p>
    );
  }

  const availableCount = slots.filter(slot => slot.available).length;
  const bookedCount = slots.filter(slot => !slot.available).length;


  return (
    <div>
      <div style={styles.summary}>
        <p style={styles.summaryText}>Available: <span style={styles.availableCount}>{availableCount}</span></p>
        <p style={styles.summaryText}>Booked: <span style={styles.bookedCount}>{bookedCount}</span></p>
      </div>
      <div style={styles.grid}>
        {slots.map(({ time, available }) => {
          const isSelected = time === selected;
          return (
            <button
              type="button"
              key={time}
              disabled={!available}
              onClick={() => available && onSelect(time)}
              style={{
                ...styles.slot,
                ...(isSelected              ? styles.selectedSlot    : {}),
                ...(!available              ? styles.unavailableSlot : {}),
                ...(available && !isSelected ? styles.availableSlot : {}), // Default available style
              }}
              title={!available ? "Already booked" : `Book at ${time}`}
            >
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
  },
  slot: {
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "10px 4px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.15s",
  },
  availableSlot: {
    background: "#ffffff",
    color: "#111827",
    borderColor: "#d1d5db",
  },
  selectedSlot: {
    background: "#111827",
    color: "#ffffff",
    border: "1px solid #111827",
    fontWeight: 700,
  },
  unavailableSlot: {
    background: "#f3f4f6",
    color: "#d1d5db",
    cursor: "not-allowed",
    borderColor: "#f3f4f6",
  },
  skeleton: {
    height: "40px",
    borderRadius: "8px",
    background: "#f3f4f6",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  empty: {
    color: "#9ca3af",
    fontSize: "14px",
    margin: 0,
  },
  summary: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "12px",
    padding: "0 4px",
  },
  summaryText: {
    fontSize: "14px",
    color: "#4b5563",
    margin: 0,
  },
  availableCount: {
    fontWeight: 600,
    color: "#10b981", // Green
  },
  bookedCount: {
    fontWeight: 600,
    color: "#ef4444", // Red
  },
};
