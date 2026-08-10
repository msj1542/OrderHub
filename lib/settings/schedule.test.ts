import { describe, it, expect } from "vitest";
import {
  computeExpectedCompletion,
  computeRushFee,
  businessDaysBetween,
  getExpeditedDateWindow,
  computeFixedMaxLeadDays,
  computeTieredRushFeePercent,
  type AppSettings,
} from "./schedule";

const BASE_SETTINGS: AppSettings = {
  businessTimezone:    "America/Chicago",
  rushFeeMode:         "percentage",
  rushFeeValue:        20,
  rushFeeTierMaxPercent: 34.5,
  rushFeeTierMinPercent: 3,
  cutoffWeekday:       "Monday",
  cutoffTime:          "12:00",
  completionWeekday:   "Friday",
  completionTime:      "15:30",
  completionWeekOffset: "same",
  duplicateWindowDays: 3,
  labelWidthIn:        3,
  labelHeightIn:       1,
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

  // Regression: computeExpectedCompletion must anchor on the *business
  // timezone's* calendar date, not now's raw UTC date. Chicago is behind
  // UTC, so evening local time already reads as the next UTC day — using
  // the UTC date as the base silently shifted every result +1 day.
  it("order placed Sunday evening (UTC date already rolled to Monday) → still keyed off the local Sunday", () => {
    // Sunday 2026-08-09, 8:00pm CDT = Monday 2026-08-10, 01:00 UTC.
    const now = winterDate("2026-08-10T01:00:00Z");
    const cutoffMidnight: AppSettings = { ...BASE_SETTINGS, cutoffTime: "00:00" };
    const result = computeExpectedCompletion(cutoffMidnight, now);
    expect(result).toBe("2026-08-14"); // Friday the 14th, not Saturday the 15th
  });

  it("completionWeekOffset='next' pushes an otherwise-same-week completion out a full cycle", () => {
    // cutoff Monday / completion Tuesday is ambiguous: "same" week reads as
    // a 1-day turnaround, "next" reads as an 8-day turnaround.
    const sameWeek: AppSettings = { ...BASE_SETTINGS, completionWeekday: "Tuesday", completionWeekOffset: "same" };
    const nextWeek: AppSettings = { ...BASE_SETTINGS, completionWeekday: "Tuesday", completionWeekOffset: "next" };
    const now = winterDate("2025-01-06T16:00:00Z"); // Mon 10:00 CST, before cutoff
    expect(computeExpectedCompletion(sameWeek, now)).toBe("2025-01-07"); // next day
    expect(computeExpectedCompletion(nextWeek, now)).toBe("2025-01-14"); // 8 days out
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

describe("businessDaysBetween", () => {
  it("Thursday to the following Tuesday = 3 (weekend doesn't count)", () => {
    // 2026-08-06 (Thu) -> 2026-08-11 (Tue)
    expect(businessDaysBetween("2026-08-06", "2026-08-11")).toBe(3);
  });

  it("same day or past → 0", () => {
    expect(businessDaysBetween("2026-08-10", "2026-08-10")).toBe(0);
    expect(businessDaysBetween("2026-08-10", "2026-08-09")).toBe(0);
  });
});

// Operations settings for these examples (per rushFeeCalculation.md):
//   Cutoff: Monday 12:00p · Completion: Friday (same week) 3:30p
//   Tiered rush fee: Max 34.5% (1 business day out) · Min 3% (last valid day)
//
// 2026-08-10 is a Monday (America/Chicago is UTC-5 / CDT in August).
const TIERED_SETTINGS: AppSettings = {
  ...BASE_SETTINGS,
  rushFeeMode: "tiered",
  rushFeeTierMaxPercent: 34.5,
  rushFeeTierMinPercent: 3,
};

describe("computeFixedMaxLeadDays — locked in from the schedule config, not from today", () => {
  it("is 7 for the example schedule (longest window: placed just after Monday's cutoff)", () => {
    expect(computeFixedMaxLeadDays(TIERED_SETTINGS)).toBe(7);
  });

  it("does not change based on which real date is passed to getExpeditedDateWindow", () => {
    const a = getExpeditedDateWindow(TIERED_SETTINGS, new Date("2026-08-10T18:30:00Z")); // Mon 1:30pm CDT
    const b = getExpeditedDateWindow(TIERED_SETTINGS, new Date("2026-08-12T21:45:00Z")); // Wed 4:45pm CDT
    expect(a.maxDaysOut).toBe(7);
    expect(b.maxDaysOut).toBe(7);
  });
});

describe("the locked-in tiered percent table (1..7 business days out)", () => {
  // Linear interpolation between 34.5% (position 1) and 3% (position 7).
  const EXPECTED = [34.5, 29.25, 24, 18.75, 13.5, 8.25, 3];

  it.each(EXPECTED.map((pct, i) => [i + 1, pct] as const))(
    "position %i → %s%%",
    (position, pct) => {
      // Anchor "now" so the window's first slot (position 1) is 2026-08-12,
      // then walk forward by (position - 1) business days.
      const now = new Date("2026-08-10T18:30:00Z"); // Mon 1:30pm CDT — see scenario 2 below
      const window = getExpeditedDateWindow(TIERED_SETTINGS, now);
      let d = window.min;
      for (let i = 1; i < position; i++) d = businessDayAfter(d);
      expect(computeTieredRushFeePercent(TIERED_SETTINGS, now, d)).toBeCloseTo(pct, 2);
    },
  );
});

function businessDayAfter(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

describe("getExpeditedDateWindow — regression: Sunday evening in Chicago (UTC date already rolled to Monday)", () => {
  it("window is keyed off local Sunday, not UTC Monday — Tue/Wed/Thu, not Wed/Thu/Fri", () => {
    // Sunday 2026-08-09, 8:00pm CDT = Monday 2026-08-10, 01:00 UTC.
    const now = new Date("2026-08-10T01:00:00Z");
    const cutoffMidnight: AppSettings = { ...TIERED_SETTINGS, cutoffTime: "00:00" };
    const window = getExpeditedDateWindow(cutoffMidnight, now);
    expect(window.min).toBe("2026-08-11"); // Tuesday
  });
});

describe("worked scenario 1 — placed Friday 1:30pm (rushFeeCalculation.md)", () => {
  // Friday 2026-08-14, 1:30pm CDT = 18:30 UTC.
  const now = new Date("2026-08-14T18:30:00Z");

  it("window is Tue(18)/Wed(19)/Thu(20) — Mon blocked (past daily cutoff), next Fri is normal completion", () => {
    const window = getExpeditedDateWindow(TIERED_SETTINGS, now);
    expect(window.min).toBe("2026-08-18");
    expect(window.max).toBe("2026-08-20");
  });

  it("fees are 34.5% / 29.25% / 24%", () => {
    expect(computeTieredRushFeePercent(TIERED_SETTINGS, now, "2026-08-18")).toBeCloseTo(34.5, 2);
    expect(computeTieredRushFeePercent(TIERED_SETTINGS, now, "2026-08-19")).toBeCloseTo(29.25, 2);
    expect(computeTieredRushFeePercent(TIERED_SETTINGS, now, "2026-08-20")).toBeCloseTo(24, 2);
  });
});

describe("worked scenario 2 — placed Monday 1:30pm (rushFeeCalculation.md)", () => {
  // Monday 2026-08-10, 1:30pm CDT = 18:30 UTC.
  const now = new Date("2026-08-10T18:30:00Z");

  it("window is Wed(12) through Thu(20) of the following week — Tue blocked, 7 slots", () => {
    const window = getExpeditedDateWindow(TIERED_SETTINGS, now);
    expect(window.min).toBe("2026-08-12");
    expect(window.max).toBe("2026-08-20");
    expect(businessDaysBetween(window.min, window.max) + 1).toBe(7);
  });

  it("fees walk the full locked-in table", () => {
    const dates = ["2026-08-12", "2026-08-13", "2026-08-14", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"];
    const expected = [34.5, 29.25, 24, 18.75, 13.5, 8.25, 3];
    dates.forEach((d, i) => {
      expect(computeTieredRushFeePercent(TIERED_SETTINGS, now, d)).toBeCloseTo(expected[i], 2);
    });
  });
});

describe("worked scenario 3 — placed Wednesday 4:45pm (rushFeeCalculation.md)", () => {
  // Wednesday 2026-08-12, 4:45pm CDT = 21:45 UTC.
  const now = new Date("2026-08-12T21:45:00Z");

  it("window is Fri(14) through Thu(20) — Thu blocked (past daily cutoff), 5 slots", () => {
    const window = getExpeditedDateWindow(TIERED_SETTINGS, now);
    expect(window.min).toBe("2026-08-14");
    expect(window.max).toBe("2026-08-20");
  });

  it("fees are 34.5% / 29.25% / 24% / 18.75% / 13.5%", () => {
    const dates = ["2026-08-14", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"];
    const expected = [34.5, 29.25, 24, 18.75, 13.5];
    dates.forEach((d, i) => {
      expect(computeTieredRushFeePercent(TIERED_SETTINGS, now, d)).toBeCloseTo(expected[i], 2);
    });
  });
});

describe("computeRushFee — tiered mode integration", () => {
  const now = new Date("2026-08-10T18:30:00Z"); // scenario 2's "now"

  it("applies the position-4 percent (18.75%) to the subtotal", () => {
    expect(computeRushFee(1000, TIERED_SETTINGS, { now, requestedDate: "2026-08-17" })).toBe(187.5);
  });

  it("tiered mode with no requestedDate → 0 (nothing to price yet)", () => {
    expect(computeRushFee(1000, TIERED_SETTINGS, { now })).toBe(0);
  });
});
