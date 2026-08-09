import { describe, it, expect } from "vitest";
import { validateInvoiceVerification } from "./invoiceVerification";

describe("validateInvoiceVerification", () => {
  const base = {
    invoiceNumber: "INV-1",
    invoiceUrl: "",
    hasDiscrepancy: false,
    discrepancyReason: "",
    attested: true,
  };

  it("passes when invoice number set, no discrepancy, and attested", () => {
    expect(validateInvoiceVerification(base)).toBeNull();
  });

  it("requires an invoice number", () => {
    expect(validateInvoiceVerification({ ...base, invoiceNumber: "" })).toMatch(/invoice number/i);
  });

  it("requires attestation", () => {
    expect(validateInvoiceVerification({ ...base, attested: false })).toMatch(/attest/i);
  });

  it("requires a discrepancy reason when hasDiscrepancy is flagged", () => {
    const result = validateInvoiceVerification({ ...base, hasDiscrepancy: true });
    expect(result).toMatch(/discrepancy/i);
  });

  it("passes when a discrepancy is flagged and a reason is provided", () => {
    const result = validateInvoiceVerification({
      ...base,
      hasDiscrepancy: true,
      discrepancyReason: "Customer requested an extra kit added after fulfillment.",
    });
    expect(result).toBeNull();
  });
});
