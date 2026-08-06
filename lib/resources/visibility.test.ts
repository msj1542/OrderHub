import { describe, it, expect } from "vitest";
import { canExternalUserSeeResource } from "./visibility";

const visibleResource = { isActive: true, customerVisible: true, pricingRestricted: false };

describe("canExternalUserSeeResource", () => {
  it("visible when active, customer-visible, and not pricing-restricted", () => {
    expect(canExternalUserSeeResource(visibleResource, { pricingVisible: false })).toBe(true);
  });

  it("hidden when inactive", () => {
    expect(canExternalUserSeeResource({ ...visibleResource, isActive: false }, { pricingVisible: true })).toBe(false);
  });

  it("hidden when not customer-visible", () => {
    expect(canExternalUserSeeResource({ ...visibleResource, customerVisible: false }, { pricingVisible: true })).toBe(false);
  });

  it("pricing-restricted resource requires the viewer's company to have pricing visible", () => {
    const restricted = { ...visibleResource, pricingRestricted: true };
    expect(canExternalUserSeeResource(restricted, { pricingVisible: true })).toBe(true);
    expect(canExternalUserSeeResource(restricted, { pricingVisible: false })).toBe(false);
  });
});
