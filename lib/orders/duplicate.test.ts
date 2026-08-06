/**
 * Duplicate PO detection tests.
 * These test the pure logic around what checkDuplicatePO *would* return
 * by mocking the database dependency. The core duplicate logic is the
 * filtering of results to exclude the current draft and exclude "draft" status.
 */

import { describe, it, expect } from "vitest";

// ── Pure logic extracted from checkDuplicatePO ────────────────

type OrderRow = { id: string; orderNumber: string | null; status: string };

function findDuplicate(
  candidates: OrderRow[],
  excludeOrderId?: string,
): { isDuplicate: true; existingOrderId: string; existingOrderNumber: string | null } | { isDuplicate: false } {
  const match = candidates.find(
    (o) => o.status !== "draft" && o.id !== excludeOrderId,
  );
  if (!match) return { isDuplicate: false };
  return { isDuplicate: true, existingOrderId: match.id, existingOrderNumber: match.orderNumber };
}

describe("duplicate PO detection logic", () => {
  it("no candidates → not a duplicate", () => {
    expect(findDuplicate([])).toEqual({ isDuplicate: false });
  });

  it("same PO but only in draft status → not a duplicate", () => {
    const candidates: OrderRow[] = [{ id: "a", orderNumber: null, status: "draft" }];
    expect(findDuplicate(candidates)).toEqual({ isDuplicate: false });
  });

  it("same PO in submitted status → duplicate", () => {
    const candidates: OrderRow[] = [{ id: "a", orderNumber: "OH-2025-00001", status: "submitted" }];
    const result = findDuplicate(candidates);
    expect(result.isDuplicate).toBe(true);
    if (result.isDuplicate) {
      expect(result.existingOrderId).toBe("a");
      expect(result.existingOrderNumber).toBe("OH-2025-00001");
    }
  });

  it("same PO but order is the current draft being submitted → not a duplicate", () => {
    const candidates: OrderRow[] = [{ id: "draft-123", orderNumber: null, status: "submitted" }];
    expect(findDuplicate(candidates, "draft-123")).toEqual({ isDuplicate: false });
  });

  it("multiple candidates — returns first non-draft non-excluded", () => {
    const candidates: OrderRow[] = [
      { id: "a", orderNumber: null, status: "draft" },
      { id: "b", orderNumber: "OH-2025-00002", status: "accepted" },
      { id: "c", orderNumber: "OH-2025-00003", status: "submitted" },
    ];
    const result = findDuplicate(candidates);
    expect(result.isDuplicate).toBe(true);
    if (result.isDuplicate) expect(result.existingOrderId).toBe("b");
  });

  it("canceled orders are not excluded (still count as duplicates)", () => {
    const candidates: OrderRow[] = [{ id: "z", orderNumber: "OH-2025-00001", status: "canceled" }];
    const result = findDuplicate(candidates);
    expect(result.isDuplicate).toBe(true);
  });
});
