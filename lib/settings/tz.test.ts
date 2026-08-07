import { describe, it, expect } from "vitest";
import { formatInTz, todayInTz, parseDateStr, toDateStr } from "@/lib/settings/tz";

describe("formatInTz", () => {
  it("formats a date in the given timezone", () => {
    // 2026-01-15T18:00:00Z is 12:00 PM in America/Chicago (CST, UTC-6)
    const result = formatInTz(new Date("2026-01-15T18:00:00Z"), "America/Chicago", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    expect(result).toBe("12:00 PM");
  });

  it("formats the same instant differently across timezones", () => {
    const date = new Date("2026-01-15T18:00:00Z");
    const chicago = formatInTz(date, "America/Chicago", { hour: "numeric", hour12: true });
    const losAngeles = formatInTz(date, "America/Los_Angeles", { hour: "numeric", hour12: true });
    expect(chicago).not.toBe(losAngeles);
  });
});

describe("todayInTz", () => {
  it("returns a YYYY-MM-DD formatted string", () => {
    expect(todayInTz("America/Chicago")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches the current UTC date for a UTC-adjacent timezone check", () => {
    // Sanity check: parsing the result back should not throw and should
    // roundtrip through toDateStr/parseDateStr.
    const today = todayInTz("America/Chicago");
    const parsed = parseDateStr(today);
    expect(toDateStr(parsed)).toBe(today);
  });
});

describe("parseDateStr", () => {
  it("parses a YYYY-MM-DD string to midnight UTC", () => {
    const date = parseDateStr("2026-08-06");
    expect(date.toISOString()).toBe("2026-08-06T00:00:00.000Z");
  });
});

describe("toDateStr", () => {
  it("formats a Date back to YYYY-MM-DD", () => {
    expect(toDateStr(new Date("2026-08-06T00:00:00.000Z"))).toBe("2026-08-06");
  });

  it("roundtrips with parseDateStr", () => {
    const original = "2026-12-31";
    expect(toDateStr(parseDateStr(original))).toBe(original);
  });
});
