import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { getWorkOrder } from "@/lib/production/service";
import { getSettings } from "@/lib/settings/schedule";
import type { WorkOrderFull, WorkOrderLineFull } from "@/lib/db/schema";

// ── Trace code ─────────────────────────────────────────────────

function traceCode(
  workOrderId: string,
  lineId: string,
  seqNum: number,
  orderNumber: string,
  suffix = "original",
): string {
  const data = `${workOrderId}:${lineId}:${seqNum}:${orderNumber}:${suffix}`;
  return createHash("sha256").update(data).digest("hex").slice(0, 12);
}

// ── Roll groups ────────────────────────────────────────────────

type RollGroup = {
  materialName: string;
  rollWidthIn:  string;
  lines: { line: WorkOrderLineFull; sku: string; qty: number; patternIn: number }[];
};

function buildRollGroups(lines: WorkOrderLineFull[]): RollGroup[] {
  const map = new Map<string, RollGroup>();
  for (const line of lines) {
    const mat = line.materialName ?? "Unknown";
    const w   = line.requiredRollWidthIn ?? "?";
    const key = `${mat}|${w}`;
    if (!map.has(key)) map.set(key, { materialName: mat, rollWidthIn: w, lines: [] });
    map.get(key)!.lines.push({
      line,
      sku:       line.skuSnapshot,
      qty:       line.quantity,
      patternIn: parseFloat(line.patternLengthIn ?? "0"),
    });
  }
  return [...map.values()];
}

// ── Piece tally grid ───────────────────────────────────────────

function renderPieceGrid(quantity: number): string {
  const pieces = Array.from({ length: quantity }, (_, i) => i + 1);
  if (quantity <= 45) {
    return `<div class="piece-grid">${pieces.map((p) => `<span class="piece">${p}</span>`).join("")}</div>`;
  }
  return pieces
    .reduce((rows: [number, number][], _, i) => {
      if (i % 5 === 0) rows.push([pieces[i], pieces[Math.min(i + 4, pieces.length - 1)]]);
      return rows;
    }, [])
    .map(([s, e]) => `<span class="piece">${s}–${e}</span>`)
    .join(" ");
}

// ── Due-out date wording, e.g. "TUESDAY, AUG. 11" ───────────────

function formatDueOut(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
  const month   = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  return `${weekday}, ${month}. ${d.getUTCDate()}`;
}

// ── Work-order HTML ────────────────────────────────────────────

function renderWorkOrder(wo: WorkOrderFull): string {
  const label = wo.orderNumber ? `WO-${wo.orderNumber}` : "Work Order";
  const rollGroups = buildRollGroups(wo.lines);

  // One header per (material, roll width) — every SKU cut from that roll is
  // listed under it with its own piece tally inline, instead of a separate
  // "Material Usage" table plus a duplicate "Piece Tally" section below.
  const materialRows = rollGroups
    .map((g) => {
      const totalKits = g.lines.reduce((s, l) => s + l.qty, 0);
      const totalFt   = g.lines.reduce((s, l) => s + (l.patternIn / 12) * l.qty, 0);
      const kitRows = g.lines
        .map(
          ({ line, sku, qty, patternIn }) => `
        <div class="kit-row">
          <div class="kit-row-head">
            <span class="kit-sku">${sku}</span>
            <span class="kit-meta">${(patternIn / 12).toFixed(2)} ft each · qty ${qty}</span>
            ${line.isExpedited ? '<span class="expedited-badge">Expedited</span>' : ""}
          </div>
          ${renderPieceGrid(qty)}
        </div>`,
        )
        .join("");
      return `
        <div class="roll-group">
          <h3>${g.materialName} · ${Math.round(parseFloat(g.rollWidthIn))}″ roll
            <span class="roll-totals">· ${totalKits} kit${totalKits !== 1 ? "s" : ""} · ${totalFt.toFixed(2)} ft total</span>
          </h3>
          ${kitRows}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${label}</title>
<style>
  html, body { background: #ececec; }
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; color: #111; }
  .page {
    width: 8.5in;
    min-height: 11in;
    margin: 0.4in auto;
    padding: 0.5in;
    box-sizing: border-box;
    background: #fff;
    box-shadow: 0 0 12px rgba(0,0,0,0.2);
  }
  h1   { font-size: 18px; margin: 0 0 2px; }
  h2   { font-size: 13px; margin: 20px 0 8px; border-bottom: 2px solid #333; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  h3   { font-size: 13px; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid #999; font-weight: 700; }
  .roll-totals { font-weight: 400; text-transform: none; color: #555; font-size: 11px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .due-dates { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .due-standard { font-size: 13px; font-weight: 700; }
  .meta { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 6px 16px; margin-bottom: 16px; padding: 10px; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; }
  .meta dt { font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
  .meta dd { margin: 0; font-size: 11px; }
  .expedited-badge { display: inline-block; background: #d32f2f; color: #fff; padding: 4px 10px; border-radius: 3px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
  .roll-group { margin-bottom: 18px; }
  .kit-row { margin: 10px 0 14px; padding-bottom: 10px; border-bottom: 1px dashed #ddd; }
  .kit-row:last-child { border-bottom: none; }
  .kit-row-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
  .kit-sku { font-weight: 600; font-size: 12px; }
  .kit-meta { color: #555; font-size: 11px; }
  .piece-grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .piece { display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border: 1px solid #ccc; font-size: 10px; border-radius: 2px; }
  .signoff { margin-top: 32px; border-top: 2px solid #333; padding-top: 12px; }
  .signoff table { font-size: 11px; }
  .signoff td { padding: 8px 0; }
  @media print {
    @page { size: letter; margin: 0.5in; }
    html, body { background: #fff; }
    .page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="page">
<div class="header">
  <div>
    <h1>${label}</h1>
  </div>
  <div class="due-dates">
    <div class="due-standard">${wo.dueDate ? `Due ${wo.dueDate}` : "No due date set"}</div>
    ${wo.isExpedited ? `<div class="expedited-badge">Expedited · Due Out: ${wo.requestedDate ? formatDueOut(wo.requestedDate) : "—"}</div>` : ""}
  </div>
</div>
<dl class="meta">
  <dt>Customer</dt><dd>${wo.companyName}</dd>
  <dt>Sales Order</dt><dd>${wo.orderNumber ?? "—"}</dd>
  <dt>Assigned To</dt><dd>${wo.claimedByName ?? "Unassigned"}</dd>
  <dt>Status</dt><dd>${wo.status}</dd>
</dl>
<h2>Material Usage</h2>
${materialRows}
<div class="signoff">
  <table style="width:100%"><tr>
    <td>Completed by: _________________________</td>
    <td>Date: _________________________</td>
    <td>QC Initials: _______</td>
  </tr></table>
</div>
</div>
<script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;
}

// ── Label HTML ─────────────────────────────────────────────────

async function renderLabels(
  wo: WorkOrderFull,
  origin: string,
  labelWidthIn: number,
  labelHeightIn: number,
  lineIds?: Set<string>,
  lineQty?: Map<string, number>,
): Promise<string> {
  const orderNumber = wo.orderNumber ?? wo.orderId.slice(0, 8);
  const lines = lineIds ? wo.lines.filter((l) => lineIds.has(l.id)) : wo.lines;

  // QR pixel size scales with the shorter label dimension so it still fits
  // comfortably at non-default label sizes.
  const qrPx = Math.max(40, Math.round(Math.min(labelWidthIn, labelHeightIn) * 72 * 0.72));

  const labelHtml: string[] = [];

  for (const line of lines) {
    const requested = lineQty?.get(line.id) ?? line.quantity;
    const count = Math.min(line.quantity, Math.max(1, requested));
    for (let seq = 1; seq <= count; seq++) {
      const code  = traceCode(wo.id, line.id, seq, orderNumber);
      const url   = `${origin}/?order=${wo.orderId}&trace=${code}`;
      const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, width: qrPx });

      labelHtml.push(`
        <div class="label${line.isExpedited ? " expedited" : ""}">
          <div class="qr">${qrSvg}</div>
          <div class="info">
            <div class="sku">${line.skuSnapshot}</div>
            <div class="mat">${line.materialName ?? ""}</div>
          </div>
        </div>`);
    }
  }

  // Pack labels into a grid of fixed letter-size sheets that mirrors the
  // on-screen preview — one page-break per label (regardless of label size)
  // was printing a single label per physical sheet.
  const MARGIN_IN = 0.25;
  const cols = Math.max(1, Math.floor((8.5 - 2 * MARGIN_IN) / labelWidthIn));
  const rows = Math.max(1, Math.floor((11 - 2 * MARGIN_IN) / labelHeightIn));
  const perSheet = cols * rows;
  const sheets: string[] = [];
  for (let i = 0; i < labelHtml.length; i += perSheet) {
    sheets.push(`<div class="sheet">${labelHtml.slice(i, i + perSheet).join("")}</div>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Labels — ${orderNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #ececec; }
  .sheet {
    width: 8.5in; min-height: 11in;
    margin: 0.2in auto;
    padding: ${MARGIN_IN}in;
    box-sizing: border-box;
    background: #fff;
    box-shadow: 0 0 12px rgba(0,0,0,0.2);
    display: grid;
    grid-template-columns: repeat(${cols}, ${labelWidthIn}in);
    grid-auto-rows: ${labelHeightIn}in;
    justify-content: start;
    align-content: start;
    page-break-after: always;
  }
  .sheet:last-child { page-break-after: auto; }
  .label {
    width: ${labelWidthIn}in; height: ${labelHeightIn}in;
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px;
    overflow: hidden;
    border: 1px solid #ddd;
  }
  .qr { flex-shrink: 0; width: ${qrPx}px; height: ${qrPx}px; }
  .qr svg { width: ${qrPx}px !important; height: ${qrPx}px !important; }
  .info { flex: 1; min-width: 0; }
  .sku   { font-size: 13px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mat   { font-size: 11px; color: #555; margin-top: 3px; }
  .label.expedited { border-left: 3px solid #d32f2f; }
  @media print {
    @page { size: letter; margin: 0; }
    body  { margin: 0; background: #fff; }
    .sheet { margin: 0; padding: ${MARGIN_IN}in; box-shadow: none; }
  }
</style>
</head>
<body>
${sheets.join("\n")}
<script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;
}

// ── Route handler ──────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [user, { id }] = await Promise.all([requireUser(), params]);
    if (!can(user, "order:print_labels")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const wo = await getWorkOrder(id, user);
    if (!wo) return new NextResponse("Not found", { status: 404 });

    const type   = req.nextUrl.searchParams.get("type") ?? "work-order";
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const linesParam = req.nextUrl.searchParams.get("lines");

    // Each entry is either a bare line id (print its full quantity) or
    // "id:qty" (print an explicit count, from the Print Labels modal's
    // per-row quantity override).
    let lineIds: Set<string> | undefined;
    let lineQty: Map<string, number> | undefined;
    if (linesParam) {
      lineIds = new Set();
      lineQty = new Map();
      for (const part of linesParam.split(",").filter(Boolean)) {
        const [partId, qtyStr] = part.split(":");
        lineIds.add(partId);
        const n = qtyStr ? parseInt(qtyStr, 10) : NaN;
        if (Number.isFinite(n) && n > 0) lineQty.set(partId, n);
      }
    }

    let html: string;
    if (type === "labels") {
      const settings = await getSettings();
      html = await renderLabels(wo, origin, settings.labelWidthIn, settings.labelHeightIn, lineIds, lineQty);
    } else {
      html = renderWorkOrder(wo);
    }

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return new NextResponse(
      err instanceof Error ? err.message : "Error",
      { status: 500 },
    );
  }
}
