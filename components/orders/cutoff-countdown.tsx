"use client";

import { useState, useEffect } from "react";

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * Timezone offset (local minus UTC, in minutes — matching ISO 8601 offset
 * suffix sign convention directly) for `date` in `tz`. Computed by reading
 * `date`'s wall-clock components in `tz` and comparing them against `date`'s
 * real UTC instant, rather than parsing an Intl "GMT±H" string — the string
 * form varies in format across ICU versions/locales and its sign is easy to
 * get backwards (this replaced exactly that kind of bug).
 */
function getTzOffsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUTC - date.getTime()) / 60000;
}

type Props = {
  cutoffWeekday: string;
  cutoffTime: string;
  businessTimezone: string;
  /** Formatted date (e.g. "Friday the 13th") an order placed right now would ship by. */
  receiveByLabel?: string;
};

/** Exported for unit tests — see cutoff-countdown.test.ts. */
export function getNextCutoff(cutoffWeekday: string, cutoffTime: string, tz: string, now: Date): Date {
  const localParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const localWeekday = localParts.find((p) => p.type === "weekday")?.value ?? "Monday";
  const localHour    = Number(localParts.find((p) => p.type === "hour")?.value   ?? 0);
  const localMinute  = Number(localParts.find((p) => p.type === "minute")?.value ?? 0);

  const cutoffDayIdx = WEEKDAY_INDEX[cutoffWeekday] ?? 1;
  const nowDayIdx    = WEEKDAY_INDEX[localWeekday]  ?? 1;

  const [cutoffH, cutoffM] = cutoffTime.split(":").map(Number);

  let daysUntilCutoff = (cutoffDayIdx - nowDayIdx + 7) % 7;
  if (daysUntilCutoff === 0) {
    const nowMinutes = localHour * 60 + localMinute;
    const cutoffMinutes = cutoffH * 60 + (cutoffM ?? 0);
    if (nowMinutes >= cutoffMinutes) daysUntilCutoff = 7;
  }

  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + daysUntilCutoff);

  const targetDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(target);
  const cutoffISO = `${targetDateStr}T${cutoffTime}:00`;

  const offsetMinutes = getTzOffsetMinutes(target, tz);
  const offsetSign = offsetMinutes < 0 ? "-" : "+";
  const absH = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  const absM = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");

  return new Date(`${cutoffISO}${offsetSign}${absH}:${absM}`);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Deadline passed";
  const hours   = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const days    = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (days > 1) return `${days}d ${remHours}h`;
  if (days === 1) return `1d ${remHours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

type Tier = "default" | "warning" | "urgent";

const TIER_STYLES: Record<Tier, { bg: string; text: string; border: string }> = {
  default: { bg: "var(--color-brand-subtle)",  text: "var(--color-brand)",         border: "var(--color-brand-border)" },
  warning: { bg: "var(--status-warning-bg)",   text: "var(--status-warning-text)", border: "var(--status-warning-border)" },
  urgent:  { bg: "var(--status-urgent-bg)",    text: "var(--status-urgent-text)",  border: "var(--status-urgent-border)" },
};

export function CutoffCountdown({ cutoffWeekday, cutoffTime, businessTimezone, receiveByLabel }: Props) {
  const [remaining, setRemaining] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("default");

  useEffect(() => {
    function update() {
      const now = new Date();
      const target = getNextCutoff(cutoffWeekday, cutoffTime, businessTimezone, now);
      const diff = target.getTime() - now.getTime();
      setRemaining(formatCountdown(diff));
      setTier(
        diff > 0 && diff < 3 * 60 * 60 * 1000  ? "urgent" :
        diff > 0 && diff < 24 * 60 * 60 * 1000 ? "warning" :
        "default",
      );
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [cutoffWeekday, cutoffTime, businessTimezone]);

  if (!remaining) return null;
  const style = TIER_STYLES[tier];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-md)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-medium)",
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      <span style={{ fontSize: "var(--text-xs)", opacity: 0.8 }}>Order cutoff in</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{remaining}</span>
      {receiveByLabel && (
        <span>to receive by <strong>{receiveByLabel}</strong></span>
      )}
    </div>
  );
}
