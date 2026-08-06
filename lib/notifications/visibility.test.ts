import { describe, it, expect } from "vitest";
import { canSeeNotification } from "./visibility";

const internalViewer = { id: "u-internal", companyId: null, isInternal: true };
const externalViewerA = { id: "u-ext-a", companyId: "co-a", isInternal: false };
const externalViewerB = { id: "u-ext-b", companyId: "co-b", isInternal: false };

describe("canSeeNotification", () => {
  it("targeted notification is visible only to that exact user", () => {
    const n = { userId: "u-ext-a", companyId: null };
    expect(canSeeNotification(n, externalViewerA)).toBe(true);
    expect(canSeeNotification(n, externalViewerB)).toBe(false);
    expect(canSeeNotification(n, internalViewer)).toBe(false);
  });

  it("internal-only broadcast (no user, no company) is visible to all internal staff only", () => {
    const n = { userId: null, companyId: null };
    expect(canSeeNotification(n, internalViewer)).toBe(true);
    expect(canSeeNotification(n, externalViewerA)).toBe(false);
    expect(canSeeNotification(n, externalViewerB)).toBe(false);
  });

  it("company broadcast is visible to internal staff and that company's users only", () => {
    const n = { userId: null, companyId: "co-a" };
    expect(canSeeNotification(n, internalViewer)).toBe(true);
    expect(canSeeNotification(n, externalViewerA)).toBe(true);
    expect(canSeeNotification(n, externalViewerB)).toBe(false);
  });
});
