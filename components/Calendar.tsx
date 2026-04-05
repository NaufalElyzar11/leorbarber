"use client";

/**
 * components/Calendar.tsx
 *
 * Simple month calendar for date selection.
 * - Navigable by month (prev/next)
 * - Disables past dates
 * - Highlights selected date
 * - Calls onSelect(dateString) with "YYYY-MM-DD"
 */

import { useState } from "react";

interface CalendarProps {
  selected: string | null; // "YYYY-MM-DD"
  onSelect: (date: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function Calendar({ selected, onSelect }: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [view, setView] = useState(
    selected
      ? new Date(selected + "T00:00:00")
      : new Date(today)
  );

  const year = view.getFullYear();
  const month = view.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function prevMonth() {
    setView(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setView(new Date(year, month + 1, 1));
  }

  // Blank leading cells
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div style={styles.wrapper}>
      {/* Month navigation */}
      <div style={styles.nav}>
        <button type="button" style={styles.navBtn} onClick={prevMonth} aria-label="Previous month">‹</button>
        <span style={styles.monthLabel}>{MONTHS[month]} {year}</span>
        <button type="button" style={styles.navBtn} onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={styles.grid}>
        {DAYS.map((d) => (
          <div key={d} style={styles.dayHeader}>{d}</div>
        ))}

        {/* Blank cells */}
        {blanks.map((_, i) => (
          <div key={`b${i}`} />
        ))}

        {/* Date cells */}
        {days.map((day) => {
          const dateStr = toDateStr(year, month, day);
          const dateObj = new Date(dateStr + "T00:00:00");
          const isPast = dateObj < today;
          const isSelected = dateStr === selected;

          return (
            <button
              type="button"
              key={day}
              onClick={() => !isPast && onSelect(dateStr)}
              disabled={isPast}
              style={{
                ...styles.dayBtn,
                ...(isPast     ? styles.past     : {}),
                ...(isSelected ? styles.selected : {}),
              }}
              aria-label={dateStr}
              aria-pressed={isSelected}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "16px",
    background: "#fff",
    userSelect: "none",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  navBtn: {
    background: "none",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    padding: "4px 12px",
    cursor: "pointer",
    fontSize: "16px",
    color: "#374151",
  },
  monthLabel: {
    fontWeight: 600,
    fontSize: "15px",
    color: "#111827",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
  },
  dayHeader: {
    textAlign: "center",
    fontSize: "11px",
    fontWeight: 600,
    color: "#9ca3af",
    padding: "4px 0",
    textTransform: "uppercase",
  },
  dayBtn: {
    border: "1px solid transparent",
    borderRadius: "6px",
    padding: "6px 0",
    background: "none",
    cursor: "pointer",
    fontSize: "13px",
    color: "#111827",
    textAlign: "center",
    transition: "background 0.15s",
  },
  past: {
    color: "#d1d5db",
    cursor: "default",
  },
  selected: {
    background: "#111827",
    color: "#ffffff",
    border: "1px solid #111827",
    fontWeight: 700,
  },
};
