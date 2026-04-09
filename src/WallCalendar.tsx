"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import coverImg from './assets/cover.webp'
import './WallCalendar.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type ThemeKey = "blue" | "teal" | "amber" | "rose" | "slate";

interface Theme {
  main: string;
  dark: string;
  light: string;
}

interface DatePoint {
  y: number;
  m: number;
  d: number;
}

interface NotesStore {
  [key: string]: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
] as const;

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const HOLIDAYS: Record<string, string> = {
  "2026-1-1": "New Year's Day",
  "2026-1-26": "Republic Day",
  "2026-3-14": "Holi",
  "2026-4-14": "Dr. Ambedkar Jayanti",
  "2026-5-1": "Labour Day",
  "2026-8-15": "Independence Day",
  "2026-10-2": "Gandhi Jayanti",
  "2026-10-20": "Dussehra",
  "2026-11-5": "Diwali",
  "2026-12-25": "Christmas Day",
};

const THEMES: Record<ThemeKey, Theme> = {
  blue:  { main: "#1a85d6", dark: "#0e5fa0", light: "#e8f4fd" },
  teal:  { main: "#0d9488", dark: "#0f766e", light: "#d1fae5" },
  amber: { main: "#d97706", dark: "#b45309", light: "#fef3c7" },
  rose:  { main: "#e11d48", dark: "#9f1239", light: "#ffe4e6" },
  slate: { main: "#475569", dark: "#1e293b", light: "#f1f5f9" },
};

const THEME_DOTS: { key: ThemeKey; color: string; label: string }[] = [
  { key: "blue",  color: "#1a85d6", label: "Ocean" },
  { key: "teal",  color: "#0d9488", label: "Forest" },
  { key: "amber", color: "#d97706", label: "Sunset" },
  { key: "rose",  color: "#e11d48", label: "Rose" },
  { key: "slate", color: "#475569", label: "Slate" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) - Math.round(amount * 255)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) - Math.round(amount * 255)));
  const b = Math.max(0, Math.min(255, (n & 0xff) - Math.round(amount * 255)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function toComparable(dt: DatePoint): number {
  return dt.y * 10000 + dt.m * 100 + dt.d;
}

function formatDate(dt: DatePoint | null): string {
  if (!dt) return "";
  return `${SHORT_MONTHS[dt.m]} ${dt.d}`;
}

function daysBetween(a: DatePoint, b: DatePoint): number {
  const d1 = new Date(a.y, a.m, a.d);
  const d2 = new Date(b.y, b.m, b.d);
  return Math.abs(Math.round((d2.getTime() - d1.getTime()) / 86400000)) + 1;
}

function getHolidaysForMonth(year: number, month: number): Record<number, string> {
  const result: Record<number, string> = {};
  Object.entries(HOLIDAYS).forEach(([key, name]) => {
    const [y, m, d] = key.split("-").map(Number);
    if (y === year && m === month + 1) result[d] = name;
  });
  return result;
}

const LS_KEY = "wc-notes";

function notesKey(year: number, month: number): string {
  return `${year}-${month}`;
}

function dateKey(dt: DatePoint): string {
  return `${dt.y}-${dt.m + 1}-${dt.d}`;
}

function rangeNoteKey(start: DatePoint, end: DatePoint | null): string {
  if (!end) return dateKey(start);
  const s = toComparable(start) <= toComparable(end) ? start : end;
  const e = toComparable(start) <= toComparable(end) ? end   : start;
  return `${dateKey(s)}__${dateKey(e)}`;
}

function loadNotes(): NotesStore {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); }
  catch { return {}; }
}

function saveNotes(store: NotesStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

// ─── NotesList Component ─────────────────────────────────────────────────────

interface NotesListItem {
  key: string;
  notes: string[];
}

interface NotesListProps {
  items: NotesListItem[];
  onDeleteGroup: (key: string) => void;
  onDeleteNote: (key: string, noteIndex: number) => void;
}

function NotesList({ items, onDeleteGroup, onDeleteNote }: NotesListProps) {
  if (items.length === 0)
    return <p className="wc-nl-empty">No notes this month</p>;

  return (
    <div className="wc-nl-scroll">
      {items.map(({ key: k, notes: noteItems }) => {
        const isRange = k.includes("__");
        const label = isRange
          ? k.replace("__", " – ").replace(/-/g, "/")
          : k.replace(/-/g, "/");
        return (
          <div key={k} className="wc-nl-group">
            <div className={`wc-nl-group-header ${isRange ? "wc-nl-group-header--range" : "wc-nl-group-header--single"}`}>
              <span className="wc-nl-dot" />
              <span className="wc-nl-group-label">{label}</span>
              <button
                className="wc-nl-del-group"
                onClick={() => onDeleteGroup(k)}
                title="Delete all notes for this date"
                type="button"
              >
                ✕
              </button>
            </div>
            {noteItems.map((note, i) => (
              <div key={i} className="wc-nl-item">
                <span className="wc-nl-item-text">{note}</span>
                <button
                  className="wc-nl-del-note"
                  onClick={() => onDeleteNote(k, i)}
                  title="Delete note"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SpiralBinding() {
  const coils = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="wc-spiral-bar">
      <div className="wc-nail-hook" />
      {coils.map((i) => (
        <div key={i} className="wc-coil" />
      ))}
    </div>
  );
}

interface DayCellProps {
  day: number;
  isOtherMonth?: boolean;
  isToday?: boolean;
  isWeekend?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  inRange?: boolean;
  hasHoliday?: boolean;
  noteType?: "single" | "range" | null;
  onClick?: () => void;
}

function DayCell({
  day, isOtherMonth, isToday, isWeekend,
  isStart, isEnd, inRange, hasHoliday, noteType, onClick,
}: DayCellProps) {
  const classes = [
    "wc-day",
    isOtherMonth ? "wc-day--other" : "",
    isToday      ? "wc-day--today" : "",
    isWeekend    ? "wc-day--weekend" : "",
    isStart      ? "wc-day--start" : "",
    isEnd        ? "wc-day--end" : "",
    inRange && !isStart && !isEnd ? "wc-day--range" : "",
    hasHoliday   ? "wc-day--holiday" : "",
    noteType === "single" ? "wc-day--note-single" : "",
    noteType === "range"  ? "wc-day--note-range"  : "",
  ].filter(Boolean).join(" ");

  return (
    <button className={classes} onClick={onClick} disabled={isOtherMonth} type="button">
      {day}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface WallCalendarProps {
  /** Initial month to display (0-indexed). Defaults to current month. */
  initialMonth?: number;
  /** Initial year to display. Defaults to current year. */
  initialYear?: number;
  /** Initial theme. Defaults to "blue". */
  initialTheme?: ThemeKey;
  /** Called whenever the date range changes. */
  onRangeChange?: (start: DatePoint | null, end: DatePoint | null) => void;
}

export default function WallCalendar({
  initialMonth,
  initialYear,
  initialTheme = "blue",
  onRangeChange,
}: WallCalendarProps) {
  const today = new Date();
  const [year, setYear]     = useState(initialYear  ?? today.getFullYear());
  const [month, setMonth]   = useState(initialMonth ?? today.getMonth());
  const [theme, setTheme]   = useState<ThemeKey>(initialTheme);
  const [rangeStart, setRangeStart] = useState<DatePoint | null>(null);
  const [rangeEnd,   setRangeEnd]   = useState<DatePoint | null>(null);
  const [selecting,  setSelecting]  = useState(false);
  const [notes, setNotes] = useState<NotesStore>(loadNotes);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<"year" | "month" | null>(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, right: 0 });
  const [flipDir, setFlipDir] = useState<"next" | "prev" | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      const pop = document.getElementById("wc-picker-portal");
      if (
        overlayRef.current && !overlayRef.current.contains(e.target as Node) &&
        pop && !pop.contains(e.target as Node)
      ) setPickerOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const openPicker = (type: "year" | "month") => {
    if (overlayRef.current) {
      const r = overlayRef.current.getBoundingClientRect();
      setPickerPos({ top: r.bottom + window.scrollY + 6, right: window.innerWidth - r.right });
    }
    setPickerOpen((v) => v === type ? null : type);
  };

  const t = THEMES[theme];
  const holidays = getHolidaysForMonth(year, month);

  // Active notes key: per selected date/range, fallback to month
  const activeKey = rangeStart
    ? rangeNoteKey(rangeStart, rangeEnd)
    : notesKey(year, month);

  const currentNotes = notes[activeKey] ?? ["", "", ""];

  // Notify parent on range change
  useEffect(() => {
    onRangeChange?.(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd, onRangeChange]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const flipAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { flipAudio.current = new Audio("/flip.mp3"); }, []);

  const triggerFlip = useCallback((dir: "next" | "prev", cb: () => void) => {
    if (flipAudio.current) { flipAudio.current.currentTime = 0; flipAudio.current.play().catch(() => {}); }
    setFlipDir(dir);
    setTimeout(() => {
      cb();
      setFlipDir(null);
    }, 380);
  }, []);

  const prevMonth = useCallback(() => {
    triggerFlip("prev", () => {
      const d = new Date(year, month - 1, 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setRangeStart(null);
      setRangeEnd(null);
      setSelecting(false);
    });
  }, [year, month, triggerFlip]);

  const nextMonth = useCallback(() => {
    triggerFlip("next", () => {
      const d = new Date(year, month + 1, 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setRangeStart(null);
      setRangeEnd(null);
      setSelecting(false);
    });
  }, [year, month, triggerFlip]);

  // ── Day selection ───────────────────────────────────────────────────────────

  const handleDayClick = useCallback((d: number) => {
    const pt: DatePoint = { y: year, m: month, d };
    if (!selecting || !rangeStart) {
      setRangeStart(pt);
      setRangeEnd(null);
      setSelecting(true);
    } else {
      setRangeEnd(pt);
      setSelecting(false);
    }
  }, [selecting, rangeStart, year, month]);

  const clearSelection = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setSelecting(false);
  };

  // ── Notes ───────────────────────────────────────────────────────────────────

  const updateNote = (idx: number, val: string) => {
    setNotes((prev) => {
      const arr = [...(prev[activeKey] ?? ["", "", ""])];
      arr[idx] = val;
      const next = { ...prev, [activeKey]: arr };
      saveNotes(next);
      return next;
    });
  };

  const addNote = () => {
    setNotes((prev) => {
      const next = { ...prev, [activeKey]: [...(prev[activeKey] ?? ["", "", ""]), ""] };
      saveNotes(next);
      return next;
    });
  };

  const deleteNoteGroup = (key: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      delete next[key];
      saveNotes(next);
      return next;
    });
  };

  const deleteNoteItem = (key: string, idx: number) => {
    setNotes((prev) => {
      const arr = (prev[key] ?? []).filter((_, i) => i !== idx);
      const next = arr.length ? { ...prev, [key]: arr } : { ...prev };
      if (!arr.length) delete next[key];
      saveNotes(next);
      return next;
    });
  };

  // ── Calendar grid ────────────────────────────────────────────────────────────

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Days in current month that have non-empty notes, with type
  const daysWithNoteType = new Map<number, "single" | "range">();
  Object.entries(notes).forEach(([k, arr]) => {
    if (!arr.some((v) => v.trim())) return;
    const single = k.match(/^(\d+)-(\d+)-(\d+)$/);
    if (single) {
      const [, y, m, d] = single.map(Number);
      if (y === year && m === month + 1) daysWithNoteType.set(d, "single");
      return;
    }
    const range = k.match(/^(\d+)-(\d+)-(\d+)__(\d+)-(\d+)-(\d+)$/);
    if (range) {
      const [, sy, sm, sd, ey, em, ed] = range.map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end   = new Date(ey, em - 1, ed);
      for (let day = 1; day <= daysInMonth; day++) {
        const cur = new Date(year, month, day);
        if (cur >= start && cur <= end) daysWithNoteType.set(day, "range");
      }
    }
  });

  // All notes for this month (for list view)
  const monthNotesList = Object.entries(notes)
    .filter(([k, arr]) => {
      if (!arr.some((v) => v.trim())) return false;
      const single = k.match(/^(\d+)-(\d+)-(\d+)$/);
      if (single) { const [, y, m] = single.map(Number); return y === year && m === month + 1; }
      const range = k.match(/^(\d+)-(\d+)-(\d+)__(\d+)-(\d+)-(\d+)$/);
      if (range) {
        const [, sy, sm, , ey, em] = range.map(Number);
        return (sy === year && sm === month + 1) || (ey === year && em === month + 1);
      }
      return false;
    })
    .map(([k, arr]) => ({ key: k, notes: arr.filter((v) => v.trim()) }));

  const rs = rangeStart ? toComparable(rangeStart) : null;
  const re = rangeEnd   ? toComparable(rangeEnd)   : null;
  const minR = rs !== null && re !== null ? Math.min(rs, re) : rs;
  const maxR = rs !== null && re !== null ? Math.max(rs, re) : rs;

  // ── Selection summary ────────────────────────────────────────────────────────

  let selectionSummary = "";
  let notesRangeLabel = "";

  if (rangeStart && rangeEnd) {
    const rsC = toComparable(rangeStart);
    const reC = toComparable(rangeEnd);
    const start = rsC <= reC ? rangeStart : rangeEnd;
    const end   = rsC <= reC ? rangeEnd   : rangeStart;
    const days  = daysBetween(start, end);
    selectionSummary = `${formatDate(start)} – ${formatDate(end)} · ${days} day${days > 1 ? "s" : ""}`;
    notesRangeLabel  = `${formatDate(start)} – ${formatDate(end)}`;
  } else if (rangeStart) {
    selectionSummary = `Start: ${formatDate(rangeStart)}`;
    notesRangeLabel  = formatDate(rangeStart);
  }

  // ── Theme CSS variables ──────────────────────────────────────────────────────

  const themeVars = {
    "--wc-main":       t.main,
    "--wc-dark":       t.dark,
    "--wc-light":      t.light,
    "--wc-range-bg":   hexToRgba(t.main, 0.12),
    "--wc-range-bd":   hexToRgba(t.main, 0.3),
    "--wc-hero-start": darken(t.dark, 0.3),
    "--wc-hero-end":   t.main,
  } as React.CSSProperties;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="wc-root" style={themeVars}>
        {/* Wire binding */}
        <SpiralBinding />

        {/* Main card */}
        <div className={`wc-card${flipDir ? ` wc-card--flip-${flipDir}` : ""}`}>

          {/* ── Hero ── */}
          {/*
            LAYER STACK (bottom → top):
            z=2   .wc-cover-wrap    photo with smooth curved dip at bottom
            z=10  .wc-shape-left    white triangle cut (bottom-left, above photo)
            z=20  .wc-shape-right   blue angled shape (bottom-right, above photo)
            z=30  .wc-hero-overlay  year + month text (inside blue shape)
          */}
          <div className="wc-hero">

            {/* z=1 — Left blue triangle, sharp edges, no radius */}
            <div className="wc-shape-left" />

            {/* z=1 — Right blue parallelogram (rotated rectangle) */}
            <div className="wc-shape-right">
              {/* Year + month text sits inside this shape, below the photo */}
              <div className="wc-hero-overlay" ref={overlayRef}>
                <span className="wc-year" onClick={() => openPicker("year")}>{year}</span>
                <span className="wc-month" onClick={() => openPicker("month")}>{MONTHS[month]}</span>
                <div className="wc-nav-btns">
                  <button className="wc-nav-btn" onClick={prevMonth} aria-label="Previous month"><FontAwesomeIcon icon={faChevronLeft} /></button>
                  <button className="wc-nav-btn" onClick={nextMonth} aria-label="Next month"><FontAwesomeIcon icon={faChevronRight} /></button>
                </div>
              </div>

              {/* Picker portal — renders outside overflow:hidden containers */}
              {pickerOpen && createPortal(
                <div
                  id="wc-picker-portal"
                  className="wc-picker-popover"
                  style={{ top: pickerPos.top, right: pickerPos.right }}
                >
                  {pickerOpen === "year"
                    ? Array.from({ length: 21 }, (_, i) => today.getFullYear() - 5 + i).map((y) => (
                        <button
                          key={y}
                          className={`wc-picker-item${y === year ? " wc-picker-item--active" : ""}`}
                          onClick={() => { triggerFlip(y > year ? "next" : "prev", () => { setYear(y); setRangeStart(null); setRangeEnd(null); setSelecting(false); }); setPickerOpen(null); }}
                          type="button"
                        >{y}</button>
                      ))
                    : MONTHS.map((name, i) => (
                        <button
                          key={i}
                          className={`wc-picker-item${i === month ? " wc-picker-item--active" : ""}`}
                          onClick={() => { triggerFlip(i > month ? "next" : "prev", () => { setMonth(i); setRangeStart(null); setRangeEnd(null); setSelecting(false); }); setPickerOpen(null); }}
                          type="button"
                        >{name}</button>
                      ))
                  }
                </div>,
                document.body
              )}
            </div>

            {/* z=2 — Cover div with bg-image, V-shape clip + shadow */}
            <div
              className="wc-cover-wrap"
              style={{ backgroundImage: `url(${coverImg})` }}
            />

          </div>

          {/* Lower panel */}
          <div className="wc-lower">

            {/* Notes */}
            <aside className="wc-notes">
              <div className="wc-notes-header">
                <button
                  className="wc-notes-collapse-btn"
                  onClick={() => setNotesOpen((v) => !v)}
                  type="button"
                  aria-expanded={notesOpen}
                >
                  <p className="wc-notes-label">Notes</p>
                  <span className={`wc-notes-chevron${notesOpen ? " wc-notes-chevron--open" : ""}`}>
                    <FontAwesomeIcon icon={faChevronDown} />
                  </span>
                </button>
                <button
                  className="wc-notes-toggle"
                  onClick={() => setShowAllNotes((v) => !v)}
                  type="button"
                >
                  {showAllNotes ? "Edit" : `All (${monthNotesList.length})`}
                </button>
              </div>

              <div className={`wc-notes-body${notesOpen ? " wc-notes-body--open" : ""}`}>
                {showAllNotes ? (
                  <NotesList
                    items={monthNotesList}
                    onDeleteGroup={deleteNoteGroup}
                    onDeleteNote={deleteNoteItem}
                  />
                ) : (
                  <>
                    <p className="wc-notes-range">
                      {notesRangeLabel || `${SHORT_MONTHS[month]} ${year}`}
                    </p>
                    <div className="wc-notes-fields">
                      {currentNotes.map((val, i) => (
                        <input
                          key={i}
                          className="wc-note-input"
                          type="text"
                          placeholder={`Note ${i + 1}…`}
                          value={val}
                          onChange={(e) => updateNote(i, e.target.value)}
                        />
                      ))}
                    </div>
                    <button className="wc-add-note" onClick={addNote} type="button">
                      + add note
                    </button>
                  </>
                )}

                {/* Holidays */}
                <div className="wc-holidays">
                  <p className="wc-holidays-label">This month</p>
                  {Object.keys(holidays).length === 0 ? (
                    <p className="wc-no-holiday">No holidays</p>
                  ) : (
                    Object.entries(holidays).map(([d, name]) => (
                      <div key={d} className="wc-holiday-item">
                        <span className="wc-holiday-dot" />
                        <span><strong>{d}</strong> {name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>

            {/* Calendar grid */}
            <div className="wc-grid-panel">
              {/* Weekday headers */}
              <div className="wc-weekdays">
                {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => (
                  <div key={d} className={`wc-weekday${d === "SAT" || d === "SUN" ? " wc-weekday--weekend" : ""}`}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="wc-days" role="grid" aria-label={`${MONTHS[month]} ${year}`}>
                {/* Previous month overflow */}
                {Array.from({ length: startOffset }, (_, i) => (
                  <DayCell
                    key={`prev-${i}`}
                    day={prevMonthDays - startOffset + 1 + i}
                    isOtherMonth
                  />
                ))}

                {/* Current month */}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const dayOfWeek = new Date(year, month, d).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isToday =
                    today.getFullYear() === year &&
                    today.getMonth() === month &&
                    today.getDate() === d;
                  const comp = toComparable({ y: year, m: month, d });
                  const isStart = rs !== null && comp === rs;
                  const isEnd   = re !== null && comp === re;
                  const inRange =
                    minR !== null && maxR !== null &&
                    comp >= minR && comp <= maxR;

                  return (
                    <DayCell
                      key={d}
                      day={d}
                      isToday={isToday}
                      isWeekend={isWeekend}
                      isStart={isStart}
                      isEnd={isEnd}
                      inRange={inRange}
                      hasHoliday={!!holidays[d]}
                      noteType={daysWithNoteType.get(d) ?? null}
                      onClick={() => handleDayClick(d)}
                    />
                  );
                })}

                {/* Next month overflow */}
                {(() => {
                  const total = startOffset + daysInMonth;
                  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
                  return Array.from({ length: remaining }, (_, i) => (
                    <DayCell key={`next-${i}`} day={i + 1} isOtherMonth />
                  ));
                })()}
              </div>

              {/* Selection hints */}
              <p className="wc-hint">
                {rangeStart && !rangeEnd
                  ? "Now click an end date"
                  : rangeEnd
                  ? "Click a date to start a new selection"
                  : "Click a date to start selecting a range"}
              </p>
              {selectionSummary && (
                <p className="wc-summary">{selectionSummary}</p>
              )}
              {(rangeStart || rangeEnd) && (
                <button className="wc-clear" onClick={clearSelection} type="button">
                  clear selection
                </button>
              )}
            </div>
          </div>

          {/* Theme picker */}
          <div className="wc-theme-bar">
            <span className="wc-theme-label">Theme</span>
            {THEME_DOTS.map(({ key: k, color, label }) => (
              <button
                key={k}
                className={`wc-theme-dot${theme === k ? " wc-theme-dot--active" : ""}`}
                style={{ background: color }}
                onClick={() => setTheme(k)}
                title={label}
                aria-label={`${label} theme`}
                aria-pressed={theme === k}
                type="button"
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
