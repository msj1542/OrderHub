/**
 * Invoice verification — pure validation logic.
 *
 * Fixes audit issue #5 ("invoice '3 matches' are theater"): the accounting
 * user attests against the *actual* order lines (shown in the UI modal),
 * and a discrepancy reason is mandatory whenever the entered invoice total
 * doesn't match the order's grand total within tolerance.
 */

const TOLERANCE = 0.005;

export type InvoiceVerificationInput = {
  invoiceNumber:      string;
  invoiceUrl:         string;
  invoiceTotal:       number | null;
  discrepancyReason:  string;
  attested:           boolean;
};

/**
 * Returns an error message if the invoice verification input is invalid,
 * or null if it's ready to submit.
 */
export function validateInvoiceVerification(
  input: InvoiceVerificationInput,
  grandTotal: number,
): string | null {
  if (!input.invoiceNumber.trim()) {
    return "Enter the invoice number.";
  }
  if (input.invoiceTotal !== null && (!Number.isFinite(input.invoiceTotal) || input.invoiceTotal < 0)) {
    return "Invoice total must be a valid non-negative currency amount.";
  }
  if (
    input.invoiceTotal !== null &&
    Math.abs(input.invoiceTotal - grandTotal) > TOLERANCE &&
    !input.discrepancyReason.trim()
  ) {
    return "Document the invoice-total discrepancy before approval.";
  }
  if (!input.attested) {
    return "You must attest that the invoice has been verified against the order lines.";
  }
  return null;
}

/** True if the entered invoice total differs from the order's grand total beyond tolerance. */
export function hasDiscrepancy(invoiceTotal: number | null, grandTotal: number): boolean {
  if (invoiceTotal === null) return false;
  return Math.abs(invoiceTotal - grandTotal) > TOLERANCE;
}
