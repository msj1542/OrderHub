import { describe, it, expect } from "vitest";
import { computeExpectedCompletion, computeRushFee, type AppSettings } from "./schedule";

const BASE_SETTINGS: AppSettings = {
  businessTimezone:    "America/Chicago",
  rushFeeMode:         "percentage",
  rushFeeValue:        20,
  cutoffWeekday:       "Monday",
  cutoffTime:          "12:00",
  completionWeekday:   "Friday",
  completionTime:      "15:30",
  duplicateWindowDays: 3,
};

// Helper — create a date at a specific UTC time that corresponds to a
// Chicago local time (UTC-5 standard / UTC-6 daylight).
// We use winter (UTC-6) dates for determinism.
function winterDate(isoUtc: string) {
  return new Date(isoUtc);
}

describe("computeExpectedCompletion", () => {
  // Monday 10:00 CST (winter = UTC-6 → 16:00 UTC) — before noon cutoff
  it("order placed Monday before cutoff → completes this Friday", () => {
    const now = winterDate("2025-01-06T16:00:00Z"); // Mon 10:00 CST
    const result = computeExpectedCompletion(BASE_SETTINGS, now);
    expect(result).toBe("2025-01-10"); // Friday 2025-01-10
  });

  // Monday 13:00 CST — after noon cutoff
  it("order placed Monday after cutoff → completes next Friday", () => {
    const now = winterDate("2025-01-06T19:00:00Z"); // Mon 13:00 CST
    const result = computeExpectedCompletion(BASE_SETTINGS, now);
    expect(result).toBe("2025-01-17"); // Friday 2025-01-17 (following week)
  });

  // Wednesday — Monday cutoff has already passed, so → next week's Friday
  it("order placed Wednesday → completes next Friday (past Monday cutoff)", () => {
    const now = winterDate("2025-01-08T16:00:00Z"); // Wed 10:00 CST
    const result = computeExpectedCompletion(BASE_SETTINGS, now);
    expect(result).toBe("2025-01-17"); // following week Friday
  });

  // Saturday — after cutoff (Mon was already past)
  it("order placed Saturday → completes next Friday", () => {
    const now = winterDate("2025-01-11T16:00:00Z"); // Sat 10:00 CST
    const result = computeExpectedCompletion(BASE_SETTINGS, now);
    expect(result).toBe("2025-01-17"); // next week Friday
  });

  // Friday — Monday cutoff has already passed, so → next week's Friday
  it("order placed Friday → completes next Friday (past Monday cutoff)", () => {
    const now = winterDate("2025-01-10T16:00:00Z"); // Fri 10:00 CST
    const result = computeExpectedCompletion(BASE_SETTINGS, now);
    expect(result).toBe("2025-01-17");
  });
});

describe("computeRushFee", () => {
  it("percentage mode: 20% of subtotal", () => {
    expect(computeRushFee(100, BASE_SETTINGS)).toBe(20);
    expect(computeRushFee(250, BASE_SETTINGS)).toBe(50);
  });

  it("flat mode: fixed value regardless of subtotal", () => {
    const settings = { ...BASE_SETTINGS, rushFeeMode: "flat" as const, rushFeeValue: 75 };
    expect(computeRushFee(100, settings)).toBe(75);
    expect(computeRushFee(0, settings)).toBe(75);
  });

  it("disabled mode: always 0", () => {
    const settings = { ...BASE_SETTINGS, rushFeeMode: "disabled" as const };
    expect(computeRushFee(100, settings)).toBe(0);
    expect(computeRushFee(9999, settings)).toBe(0);
  });

  it("percentage rounding to 2dp", () => {
    // 20% of 33.33 = 6.666 → rounds to 6.67
    expect(computeRushFee(33.33, BASE_SETTINGS)).toBe(6.67);
  });
});
