"use client";

import { useState, useEffect } from "react";

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

type Props = {
  cutoffWeekday: string;
  cutoffTime: string;
  businessTimezone: string;
};

function getNextCutoff(cutoffWeekday: string, cutoffTime: string, tz: string, now: Date): Date {
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

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(target);
  const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  const match = offsetStr.match(/GMT([+-]\d+(?::\d+)?)/);
  let offsetMinutes = 0;
  if (match) {
    const [h, m] = match[1].split(":").map(Number);
    offsetMinutes = (h ?? 0) * 60 + (Math.sign(h ?? 0) * (m ?? 0));
  }
  const offsetSign = offsetMinutes <= 0 ? "+" : "-";
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

export function CutoffCountdown({ cutoffWeekday, cutoffTime, businessTimezone }: Props) {
  const [remaining, setRemaining] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    function update() {
      const now = new Date();
      const target = getNextCutoff(cutoffWeekday, cutoffTime, businessTimezone, now);
      const diff = target.getTime() - now.getTime();
      setRemaining(formatCountdown(diff));
      setUrgent(diff > 0 && diff < 4 * 60 * 60 * 1000);
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [cutoffWeekday, cutoffTime, businessTimezone]);

  if (!remaining) return null;

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
        background: urgent ? "var(--status-urgent-bg)" : "var(--color-brand-subtle)",
        color: urgent ? "var(--status-urgent-text)" : "var(--color-brand)",
        border: `1px solid ${urgent ? "var(--status-urgent-border)" : "var(--color-brand-border)"}`,
      }}
    >
      <span style={{ fontSize: "var(--text-xs)", opacity: 0.8 }}>Order deadline</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{remaining}</span>
    </div>
  );
}
