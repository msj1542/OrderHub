import { describe, it, expect } from "vitest";
import { formatMoney, parseMoney, toDecimal, addMoney } from "@/lib/pricing/money";

describe("formatMoney", () => {
  it("formats a positive number as USD currency", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("formats a numeric string (as stored in numeric(12,2) columns)", () => {
    expect(formatMoney("28.94")).toBe("$28.94");
  });

  it("returns an em dash for null", () => {
    expect(formatMoney(null)).toBe("—");
  });

  it("returns an em dash for undefined", () => {
    expect(formatMoney(undefined)).toBe("—");
  });

  it("returns an em dash for an empty string", () => {
    expect(formatMoney("")).toBe("—");
  });

  it("returns an em dash for a non-numeric string", () => {
    expect(formatMoney("not-a-number")).toBe("—");
  });

  it("formats negative amounts (adjustments)", () => {
    expect(formatMoney(-15)).toBe("-$15.00");
  });

  it("always shows exactly 2 decimal places", () => {
    expect(formatMoney(5)).toBe("$5.00");
    expect(formatMoney(5.1)).toBe("$5.10");
  });
});

describe("parseMoney", () => {
  it("parses a plain numeric string", () => {
    expect(parseMoney("28.94")).toBe(28.94);
  });

  it("strips a leading dollar sign", () => {
    expect(parseMoney("$28.94")).toBe(28.94);
  });

  it("strips thousands separators", () => {
    expect(parseMoney("$1,234.50")).toBe(1234.5);
  });

  it("preserves a negative sign", () => {
    expect(parseMoney("-$15.00")).toBe(-15);
  });

  it("returns NaN for non-numeric input", () => {
    expect(parseMoney("abc")).toBeNaN();
  });
});

describe("toDecimal", () => {
  it("rounds to 2 decimal places", () => {
    expect(toDecimal(1.23456)).toBe("1.23");
  });

  it("pads whole numbers to 2 decimals", () => {
    expect(toDecimal(5)).toBe("5.00");
  });

  it("handles negative numbers", () => {
    expect(toDecimal(-15)).toBe("-15.00");
  });
});

describe("addMoney", () => {
  it("adds two numbers without float drift", () => {
    // 0.1 + 0.2 famously produces 0.30000000000000004 with raw float math
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });

  it("adds numeric-string values (as read back from the DB)", () => {
    expect(addMoney("10.50", "5.25")).toBe(15.75);
  });

  it("adds a subtotal, rush fee, and adjustment chain correctly", () => {
    const subtotal = 100;
    const rushFee = addMoney(0, 20); // 20% of 100 pre-computed
    const total = addMoney(subtotal, rushFee);
    expect(total).toBe(120);
  });

  it("rounds the result to the nearest cent", () => {
    expect(addMoney(1.005, 1.005)).toBe(2.01);
  });

  it("handles negative adjustments", () => {
    expect(addMoney(100, -15)).toBe(85);
  });
});
