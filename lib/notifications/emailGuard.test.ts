import { describe, it, expect } from "vitest";
import { isResendConfigured } from "./emailGuard";

describe("isResendConfigured", () => {
  it("rejects the shipped placeholder values", () => {
    expect(isResendConfigured("re_..", "orders@yourdomain.com")).toBe(false);
  });

  it("rejects a missing key or from-address", () => {
    expect(isResendConfigured(undefined, "orders@acme.com")).toBe(false);
    expect(isResendConfigured("re_" + "a".repeat(30), undefined)).toBe(false);
  });

  it("rejects a key that doesn't match the re_ pattern", () => {
    expect(isResendConfigured("sk_" + "a".repeat(30), "orders@acme.com")).toBe(false);
    expect(isResendConfigured("re_short", "orders@acme.com")).toBe(false);
  });

  it("rejects an invalid from-address", () => {
    expect(isResendConfigured("re_" + "a".repeat(30), "not-an-email")).toBe(false);
  });

  it("rejects known placeholder domains even with a plausible key", () => {
    expect(isResendConfigured("re_" + "a".repeat(30), "orders@example.com")).toBe(false);
  });

  it("accepts a plausible real key and verified-looking from-address", () => {
    expect(isResendConfigured("re_" + "a".repeat(30), "orders@hogskins.com")).toBe(true);
  });
});
