import { describe, it, expect } from "vitest";
import { can, canAny }          from "./policy";
import type { AppUser }         from "@/lib/db/schema";

// ── Fixtures ──────────────────────────────────────────────────

function makeUser(
  roleCode: string,
  opts: { isInternal?: boolean; pricingVisible?: boolean; companyId?: string } = {}
): AppUser {
  const isInternal = opts.isInternal ?? roleCode.startsWith("internal");
  return {
    id:          "00000000-0000-0000-0000-000000000001",
    authUserId:  "00000000-0000-0000-0000-000000000002",
    email:       "test@example.com",
    name:        "Test User",
    roleCode,
    companyId:   opts.companyId ?? (isInternal ? null : "00000000-0000-0000-0000-000000000003"),
    isActive:    true,
    createdAt:   new Date(),
    updatedAt:   new Date(),
    role: {
      roleCode,
      displayName: roleCode,
      isInternal,
    },
    company: isInternal
      ? null
      : {
          id:             opts.companyId ?? "00000000-0000-0000-0000-000000000003",
          name:           "Acme Corp",
          orderScope:     "own",
          pricingVisible: opts.pricingVisible ?? true,
          notes:          null,
          isActive:       true,
          primaryContactName: null,
          contactEmail:   null,
          contactPhone:   null,
          billingNotes:   null,
          createdAt:      new Date(),
          updatedAt:      new Date(),
        },
  };
}

const admin      = makeUser("internal_admin");
const coord      = makeUser("order_coordinator");
const fulfiller  = makeUser("fulfillment");
const accounting = makeUser("accounting");
const extAdmin   = makeUser("external_admin");
const extOrder   = makeUser("external_ordering");
const extRef     = makeUser("external_reference");
const extNoPricing = makeUser("external_ordering", { pricingVisible: false });

// ── internal_admin ────────────────────────────────────────────

describe("internal_admin", () => {
  it("can perform every order transition", () => {
    expect(can(admin, "order:accept")).toBe(true);
    expect(can(admin, "order:claim")).toBe(true);
    expect(can(admin, "order:qc")).toBe(true);
    expect(can(admin, "order:invoice_verify")).toBe(true);
    expect(can(admin, "order:release")).toBe(true);
    expect(can(admin, "order:close")).toBe(true);
    expect(can(admin, "order:cancel")).toBe(true);
    expect(can(admin, "order:decline_cancel")).toBe(true);
  });

  it("can manage settings, users, and companies", () => {
    expect(can(admin, "settings:manage")).toBe(true);
    expect(can(admin, "users:manage_internal")).toBe(true);
    expect(can(admin, "users:manage_external")).toBe(true);
    expect(can(admin, "companies:manage")).toBe(true);
  });

  it("can view pricing", () => {
    expect(can(admin, "pricing:view")).toBe(true);
  });

  it("can preview portal", () => {
    expect(can(admin, "portal:preview")).toBe(true);
  });
});

// ── order_coordinator ─────────────────────────────────────────

describe("order_coordinator", () => {
  it("can accept, release, cancel, decline cancel", () => {
    expect(can(coord, "order:accept")).toBe(true);
    expect(can(coord, "order:release")).toBe(true);
    expect(can(coord, "order:cancel")).toBe(true);
    expect(can(coord, "order:decline_cancel")).toBe(true);
  });

  it("cannot invoice_verify or close", () => {
    expect(can(coord, "order:invoice_verify")).toBe(false);
    expect(can(coord, "order:close")).toBe(false);
  });

  it("cannot manage settings or internal users", () => {
    expect(can(coord, "settings:manage")).toBe(false);
    expect(can(coord, "users:manage_internal")).toBe(false);
  });
});

// ── fulfillment ───────────────────────────────────────────────

describe("fulfillment", () => {
  it("can claim, qc, print labels", () => {
    expect(can(fulfiller, "order:claim")).toBe(true);
    expect(can(fulfiller, "order:qc")).toBe(true);
    expect(can(fulfiller, "order:print_labels")).toBe(true);
  });

  it("cannot accept or release orders", () => {
    expect(can(fulfiller, "order:accept")).toBe(false);
    expect(can(fulfiller, "order:release")).toBe(false);
  });

  it("can manage production", () => {
    expect(can(fulfiller, "production:view")).toBe(true);
    expect(can(fulfiller, "production:manage")).toBe(true);
  });
});

// ── accounting ────────────────────────────────────────────────

describe("accounting", () => {
  it("can invoice_verify and close", () => {
    expect(can(accounting, "order:invoice_verify")).toBe(true);
    expect(can(accounting, "order:close")).toBe(true);
  });

  it("cannot accept, cancel, or release", () => {
    expect(can(accounting, "order:accept")).toBe(false);
    expect(can(accounting, "order:cancel")).toBe(false);
    expect(can(accounting, "order:release")).toBe(false);
  });
});

// ── external_admin ────────────────────────────────────────────

describe("external_admin", () => {
  it("can create, submit, request cancel", () => {
    expect(can(extAdmin, "order:create")).toBe(true);
    expect(can(extAdmin, "order:submit")).toBe(true);
    expect(can(extAdmin, "order:request_cancel")).toBe(true);
  });

  it("cannot accept, claim, or close orders", () => {
    expect(can(extAdmin, "order:accept")).toBe(false);
    expect(can(extAdmin, "order:claim")).toBe(false);
    expect(can(extAdmin, "order:close")).toBe(false);
  });

  it("can manage external users", () => {
    expect(can(extAdmin, "users:manage_external")).toBe(true);
  });

  it("sees pricing when company pricing_visible = true", () => {
    expect(can(extAdmin, "pricing:view")).toBe(true);
  });
});

// ── external_ordering ─────────────────────────────────────────

describe("external_ordering", () => {
  it("can create and submit orders", () => {
    expect(can(extOrder, "order:create")).toBe(true);
    expect(can(extOrder, "order:submit")).toBe(true);
  });

  it("cannot manage users", () => {
    expect(can(extOrder, "users:manage_external")).toBe(false);
  });

  it("respects company pricing_visible flag", () => {
    expect(can(extOrder,     "pricing:view")).toBe(true);
    expect(can(extNoPricing, "pricing:view")).toBe(false);
  });
});

// ── external_reference ────────────────────────────────────────

describe("external_reference", () => {
  it("can view catalog and download resources only", () => {
    expect(can(extRef, "catalog:view")).toBe(true);
    expect(can(extRef, "resources:download")).toBe(true);
  });

  it("cannot create orders", () => {
    expect(can(extRef, "order:create")).toBe(false);
    expect(can(extRef, "order:submit")).toBe(false);
  });

  it("cannot view production or settings", () => {
    expect(can(extRef, "production:view")).toBe(false);
    expect(can(extRef, "settings:manage")).toBe(false);
  });
});

// ── canAny helper ─────────────────────────────────────────────

describe("canAny", () => {
  it("returns true if at least one action is permitted", () => {
    expect(canAny(extRef, ["order:create", "catalog:view"])).toBe(true);
    expect(canAny(extRef, ["order:create", "order:submit"])).toBe(false);
  });
});
