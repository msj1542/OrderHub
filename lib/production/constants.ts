/**
 * QC constants — pure, no DB import. Safe to import from client components
 * (e.g. qc-modal.tsx) without pulling the Postgres driver into the browser bundle.
 */

export const QC_ITEMS: [string, string][] = [
  ["orderAccuracy",      "Order accuracy — Correct SKUs, quantities, and material"],
  ["finishQuality",      "Finish quality — Clean, dry, and free of bubbles or lifted edges"],
  ["completionPackaging","Completion — All pieces present, labeled, and packaged correctly"],
];

export const QC_KEYS = QC_ITEMS.map(([k]) => k);
