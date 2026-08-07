import { describe, it, expect } from "vitest";
import { ROLES, INTERNAL_ROLES, EXTERNAL_ROLES, ROLE_DISPLAY, isInternal, isExternal } from "@/lib/authz/roles";

describe("role sets", () => {
  it("defines exactly 7 role codes total, split 4 internal / 3 external", () => {
    expect(Object.keys(ROLES)).toHaveLength(7);
    expect(INTERNAL_ROLES.size).toBe(4);
    expect(EXTERNAL_ROLES.size).toBe(3);
  });

  it("internal and external role sets are disjoint", () => {
    for (const role of INTERNAL_ROLES) {
      expect(EXTERNAL_ROLES.has(role)).toBe(false);
    }
  });

  it("every ROLES value has a display name", () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_DISPLAY[role]).toBeTruthy();
    }
  });
});

describe("isInternal / isExternal", () => {
  it("classifies each internal role correctly", () => {
    for (const role of INTERNAL_ROLES) {
      expect(isInternal(role)).toBe(true);
      expect(isExternal(role)).toBe(false);
    }
  });

  it("classifies each external role correctly", () => {
    for (const role of EXTERNAL_ROLES) {
      expect(isExternal(role)).toBe(true);
      expect(isInternal(role)).toBe(false);
    }
  });

  it("treats an unknown role code as neither internal nor external", () => {
    expect(isInternal("not_a_role")).toBe(false);
    expect(isExternal("not_a_role")).toBe(false);
  });
});
