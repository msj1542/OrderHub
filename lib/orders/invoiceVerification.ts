/**
 * Invoice verification — pure validation logic.
 *
 * Fixes audit issue #5 ("invoice '3 matches' are theater"): the accounting
 * user attests against the *actual* order lines (shown in the UI modal).
 *
 * The invoice total is never retyped by hand — the order's grand total is
 * shown read-only as the expected amount, and the verifying user explicitly
 * flags whether the invoice they're holding differs from it. A discrepancy
 * reason is mandatory whenever that flag is set.
 */

export type InvoiceVerificationInput = {
  invoiceNumber:     string;
  invoiceUrl:        string;
  hasDiscrepancy:    boolean;
  discrepancyReason: string;
  attested:          boolean;
};

/**
 * Returns an error message if the invoice verification input is invalid,
 * or null if it's ready to submit.
 */
export function validateInvoiceVerification(input: InvoiceVerificationInput): string | null {
  if (!input.invoiceNumber.trim()) {
    return "Enter the invoice number.";
  }
  if (input.hasDiscrepancy && !input.discrepancyReason.trim()) {
    return "Document the invoice-total discrepancy before approval.";
  }
  if (!input.attested) {
    return "You must attest that the invoice has been verified against the order lines.";
  }
  return null;
}
