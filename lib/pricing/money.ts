/** Format a numeric price (stored as numeric/string) to "$X.XX" display string. */
export function formatMoney(amount: number | string | null | undefined): string {
  if (amount == null || amount === "") return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Parse a display string like "$28.94" or "28.94" to a number. Returns NaN on failure. */
export function parseMoney(str: string): number {
  return parseFloat(str.replace(/[^0-9.-]/g, ""));
}

/** Round to 2 decimal places and return as a string suitable for numeric(12,2) columns. */
export function toDecimal(amount: number): string {
  return amount.toFixed(2);
}

/** Add two money values safely (avoids float drift). */
export function addMoney(a: number | string, b: number | string): number {
  return Math.round((Number(a) + Number(b)) * 100) / 100;
}
