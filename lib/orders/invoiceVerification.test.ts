import { describe, it, expect } from "vitest";
import { validateInvoiceVerification, hasDiscrepancy } from "./invoiceVerification";

describe("hasDiscrepancy", () => {
  it("false when invoice total is null (not yet entered)", () => {
    expect(hasDiscrepancy(null, 100)).toBe(false);
  });

  it("false when within tolerance", () => {
    expect(hasDiscrepancy(100, 100)).toBe(false);
    expect(hasDiscrepancy(100.004, 100)).toBe(false);
  });

  it("true when beyond tolerance", () => {
    expect(hasDiscrepancy(100.01, 100)).toBe(true);
    expect(hasDiscrepancy(95, 100)).toBe(true);
  });
});

describe("validateInvoiceVerification", () => {
  const base = { invoiceNumber: "INV-1", invoiceUrl: "", invoiceTotal: 100, discrepancyReason: "", attested: true };

  it("passes when invoice number set, totals match, and attested", () => {
    expect(validateInvoiceVerification(base, 100)).toBeNull();
  });

  it("requires an invoice number", () => {
    expect(validateInvoiceVerification({ ...base, invoiceNumber: "" }, 100)).toMatch(/invoice number/i);
  });

  it("requires attestation", () => {
    expect(validateInvoiceVerification({ ...base, attested: false }, 100)).toMatch(/attest/i);
  });

  it("requires a discrepancy reason when totals mismatch", () => {
    const result = validateInvoiceVerification({ ...base, invoiceTotal: 150 }, 100);
    expect(result).toMatch(/discrepancy/i);
  });

  it("passes on mismatch when a discrepancy reason is provided", () => {
    const result = validateInvoiceVerification(
      { ...base, invoiceTotal: 150, discrepancyReason: "Customer requested an extra kit added after fulfillment." },
      100,
    );
    expect(result).toBeNull();
  });

  it("allows a null invoice total (not yet known) without requiring a discrepancy reason", () => {
    expect(validateInvoiceVerification({ ...base, invoiceTotal: null }, 100)).toBeNull();
  });

  it("rejects a negative invoice total", () => {
    expect(validateInvoiceVerification({ ...base, invoiceTotal: -5 }, 100)).toMatch(/valid non-negative/i);
  });

  it("rejects a non-finite invoice total", () => {
    expect(validateInvoiceVerification({ ...base, invoiceTotal: NaN }, 100)).toMatch(/valid non-negative/i);
  });
});
