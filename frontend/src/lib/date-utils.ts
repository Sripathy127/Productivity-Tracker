/**
 * Local wall-clock date helpers.
 *
 * The API speaks naive ISO strings (`"2026-09-18T03:53:00"`). Passing those to
 * `new Date()` is safe in every modern engine (a date-time string without an
 * offset is interpreted as local time), but parsing is done explicitly here so
 * the behaviour does not depend on that subtlety.
 */

import { MINUTES_PER_DAY } from "@/lib/timeline-geometry";

const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

export function parseLocalDateTime(value: string): Date {
  const match = ISO_LOCAL.exec(value);
  if (match === null) {
    throw new Error(`Not a local ISO date-time: ${value}`);
  }
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? "0")
  );
}

/** Serialise back to the naive ISO form the API expects. */
export function formatLocalDateTime(date: Date): string {
  return `${formatDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `"2026-09"` for the month a date falls in. */
export function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function parseMonthKey(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1);
}

export function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  // Anchor on day 1 so stepping from the 31st never skips a short month.
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function daysInMonth(month: Date): number {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

/** Every day of the given month, as local `Date`s at midnight. */
export function eachDayOfMonth(month: Date): Date[] {
  const total = daysInMonth(month);
  return Array.from(
    { length: total },
    (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)
  );
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isSameDay(a: Date, b: Date): boolean {
  return formatDateKey(a) === formatDateKey(b);
}

/** `"3h 27m"`, `"48m"`, `"2h"` — compact and readable inside a bar. */
export function formatDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function formatClock(date: Date, use24Hour: boolean): string {
  if (use24Hour) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const hours = date.getHours();
  const suffix = hours < 12 ? "am" : "pm";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${pad(date.getMinutes())}${suffix}`;
}

export function formatHourLabel(hour: number, use24Hour: boolean): string {
  if (use24Hour) return `${pad(hour)}:00`;
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

/** Minute-of-day for "now", or `null` when `date` is not today. */
export function nowMinuteWithinDay(day: Date, now: Date): number | null {
  if (!isSameDay(day, now)) return null;
  return Math.min(minuteOfDay(now), MINUTES_PER_DAY);
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
