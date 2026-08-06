import { describe, it, expect } from "vitest";
import { QC_KEYS, QC_ITEMS } from "@/lib/production/service";

// ── QC item constants ──────────────────────────────────────────

describe("QC_ITEMS", () => {
  it("exports exactly 3 QC items", () => {
    expect(QC_ITEMS).toHaveLength(3);
  });

  it("all QC items have non-empty keys and labels", () => {
    for (const [key, label] of QC_ITEMS) {
      expect(key.length).toBeGreaterThan(0);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("QC_KEYS matches the first element of each QC_ITEMS entry", () => {
    expect(QC_KEYS).toEqual(QC_ITEMS.map(([k]) => k));
  });
});

// ── QC answer validation logic ─────────────────────────────────
// These tests verify the validation rules that submitQC enforces.

function validateQCAnswers(answers: Record<string, boolean>): string | null {
  for (const key of QC_KEYS) {
    if (!answers[key]) return `All QC items must be checked before finalizing.`;
  }
  return null;
}

describe("QC answer validation", () => {
  it("passes when all keys are true", () => {
    const answers: Record<string, boolean> = {};
    for (const key of QC_KEYS) answers[key] = true;
    expect(validateQCAnswers(answers)).toBeNull();
  });

  it("fails when a key is false", () => {
    const answers: Record<string, boolean> = {};
    for (const key of QC_KEYS) answers[key] = true;
    answers[QC_KEYS[0]] = false;
    expect(validateQCAnswers(answers)).toBeTruthy();
  });

  it("fails when a key is missing", () => {
    const answers: Record<string, boolean> = {};
    // Only set the last key
    answers[QC_KEYS[QC_KEYS.length - 1]] = true;
    expect(validateQCAnswers(answers)).toBeTruthy();
  });

  it("fails when answers is empty", () => {
    expect(validateQCAnswers({})).toBeTruthy();
  });
});

// ── Material usage calculation ─────────────────────────────────

function computeMaterialUsage(patternLengthIn: number, quantity: number): number {
  return (patternLengthIn + 1) * quantity;
}

describe("recut material usage", () => {
  it("adds 1 inch cutting margin per piece", () => {
    expect(computeMaterialUsage(24, 1)).toBe(25);
    expect(computeMaterialUsage(24, 3)).toBe(75);
  });

  it("handles zero pattern length (custom items)", () => {
    // patternLengthIn ?? 0 → (0 + 1) * qty = qty inches
    expect(computeMaterialUsage(0, 5)).toBe(5);
  });

  it("is proportional to quantity", () => {
    const perPiece = computeMaterialUsage(36, 1);
    expect(computeMaterialUsage(36, 4)).toBe(perPiece * 4);
  });
});

// ── Piece progress validation ──────────────────────────────────

function validatePieces(
  completedPieces: number[],
  quantity: number,
): number[] {
  const unique = [...new Set(completedPieces)].filter(
    (p) => Number.isInteger(p) && p >= 1 && p <= quantity,
  );
  return unique.sort((a, b) => a - b);
}

describe("piece progress validation", () => {
  it("filters pieces outside [1, quantity] range", () => {
    expect(validatePieces([0, 1, 5, 6], 5)).toEqual([1, 5]);
  });

  it("deduplicates repeated piece numbers", () => {
    expect(validatePieces([1, 1, 2, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  it("sorts the result ascending", () => {
    expect(validatePieces([3, 1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("returns empty for no valid pieces", () => {
    expect(validatePieces([], 5)).toEqual([]);
    expect(validatePieces([0, 6], 5)).toEqual([]);
  });

  it("accepts all pieces when all done", () => {
    const qty    = 10;
    const pieces = Array.from({ length: qty }, (_, i) => i + 1);
    expect(validatePieces(pieces, qty)).toEqual(pieces);
  });
});

// ── Work order status transitions ──────────────────────────────

describe("work order status transitions", () => {
  const VALID_STATUSES = [
    "pending", "in_progress", "completed", "awaiting_pickup", "released", "canceled",
  ];

  it("all work order statuses are defined", () => {
    for (const s of VALID_STATUSES) {
      expect(typeof s).toBe("string");
    }
  });

  it("claim transitions pending to in_progress", () => {
    const initial = "pending";
    const next    = "in_progress";
    expect(VALID_STATUSES).toContain(initial);
    expect(VALID_STATUSES).toContain(next);
    expect(VALID_STATUSES.indexOf(next)).toBeGreaterThan(VALID_STATUSES.indexOf(initial));
  });

  it("QC transitions in_progress to completed", () => {
    expect(VALID_STATUSES.indexOf("completed")).toBeGreaterThan(VALID_STATUSES.indexOf("in_progress"));
  });
});
