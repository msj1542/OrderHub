import { describe, it, expect } from "vitest";
import { getNextCutoff } from "./cutoff-countdown";

// Regression coverage for a real bug: the timezone-offset sign used to
// reconstruct the cutoff instant from its local-timezone wall-clock
// components was inverted, so any negative-offset business timezone (e.g.
// America/Chicago) produced a target roughly 2x the real offset away from
// the correct instant — reported live as a dashboard countdown showing
// ~23h remaining when the real figure was ~33h45m.

describe("getNextCutoff", () => {
  it("computes the correct instant for a negative-offset (Chicago, CDT) timezone", () => {
    // Sunday 2026-08-09 02:15 CDT (UTC-5) -> next Monday 00:00 CDT.
    const now = new Date("2026-08-09T07:15:00Z");
    const target = getNextCutoff("Monday", "00:00", "America/Chicago", now);
    expect(target.toISOString()).toBe("2026-08-10T05:00:00.000Z");
  });

  it("matches hand-computed expectations for a noon cutoff in the same scenario", () => {
    const now = new Date("2026-08-09T07:15:00Z");
    const target = getNextCutoff("Monday", "12:00", "America/Chicago", now);
    const diffHours = (target.getTime() - now.getTime()) / 3600000;
    expect(diffHours).toBeCloseTo(33.75, 2); // 33h45m
  });

  it("computes the correct instant for a positive-offset (Karachi) timezone", () => {
    // Sunday 2026-08-09 10:00 PKT (UTC+5) -> next Monday 09:00 PKT.
    const now = new Date("2026-08-09T05:00:00Z");
    const target = getNextCutoff("Monday", "09:00", "Asia/Karachi", now);
    expect(target.toISOString()).toBe("2026-08-10T04:00:00.000Z");
  });

  it("computes the correct instant for a larger-magnitude negative offset (Los Angeles, PDT)", () => {
    // Wednesday 2026-08-12 09:00 PDT (UTC-7) -> next Friday 17:00 PDT.
    const now = new Date("2026-08-12T16:00:00Z");
    const target = getNextCutoff("Friday", "17:00", "America/Los_Angeles", now);
    expect(target.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("targets later today when the cutoff weekday is today and the time hasn't passed", () => {
    // Monday 2026-08-10 09:00 CDT, cutoff Monday 17:00 CDT — same day, still ahead.
    const now = new Date("2026-08-10T14:00:00Z");
    const target = getNextCutoff("Monday", "17:00", "America/Chicago", now);
    expect(target.toISOString()).toBe("2026-08-10T22:00:00.000Z");
  });

  it("rolls over to next week when today's cutoff time has already passed", () => {
    // Monday 2026-08-10 18:00 CDT, cutoff Monday 17:00 CDT already passed -> next Monday.
    const now = new Date("2026-08-10T23:00:00Z");
    const target = getNextCutoff("Monday", "17:00", "America/Chicago", now);
    expect(target.toISOString()).toBe("2026-08-17T22:00:00.000Z");
  });

  it("stays valid when `now` carries sub-second precision, as it always does from `new Date()`", () => {
    // Regression: every fixture above uses a whole-second ISO string, which
    // hid a real bug — getTzOffsetMinutes diffed a millisecond-precision
    // instant against a whole-second-truncated one, leaving a fractional
    // remainder (e.g. -300.0065166... instead of exactly -300) that
    // corrupted the constructed offset string ("-05:0.0065166...") into
    // Invalid Date. Live-reproduced on the dashboard: the countdown showed
    // "NaNm" on every real page load, since `new Date()` essentially never
    // lands on an exact whole second.
    const now = new Date("2026-08-09T22:37:25.391Z");
    const target = getNextCutoff("Monday", "00:00", "America/Chicago", now);
    expect(Number.isNaN(target.getTime())).toBe(false);
    expect(target.toISOString()).toBe("2026-08-10T05:00:00.000Z");
  });
});
