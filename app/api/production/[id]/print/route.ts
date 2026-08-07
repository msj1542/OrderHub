import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { getWorkOrder } from "@/lib/production/service";
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
  lines: { sku: string; qty: number; patternIn: number }[];
};

function buildRollGroups(lines: WorkOrderLineFull[]): RollGroup[] {
  const map = new Map<string, RollGroup>();
  for (const line of lines) {
    const mat = line.materialName ?? "Unknown";
    const w   = line.requiredRollWidthIn ?? "?";
    const key = `${mat}|${w}`;
    if (!map.has(key)) map.set(key, { materialName: mat, rollWidthIn: w, lines: [] });
    map.get(key)!.lines.push({
      sku:       line.skuSnapshot,
      qty:       line.quantity,
      patternIn: parseFloat(line.patternLengthIn ?? "0"),
    });
  }
  return [...map.values()];
}

// ── Work-order HTML ────────────────────────────────────────────

function renderWorkOrder(wo: WorkOrderFull): string {
  const label = wo.orderNumber ? `WO-${wo.orderNumber}` : "Work Order";
  const rollGroups = buildRollGroups(wo.lines);

  const materialRows = rollGroups
    .map((g) => {
      const totalIn = g.lines.reduce((s, l) => s + l.patternIn * l.qty, 0);
      const totalFt = totalIn / 12;
      const lineRows = g.lines
        .map(
          (l) =>
            `<tr>
              <td>${l.sku}</td>
              <td>${l.qty}</td>
              <td>${(l.patternIn / 12).toFixed(2)} ft each</td>
              <td>${((l.patternIn / 12) * l.qty).toFixed(2)} ft</td>
            </tr>`,
        )
        .join("");
      return `
        <h3 style="margin:0 0 6px">${g.materialName} · ${Math.round(parseFloat(g.rollWidthIn))}″ roll</h3>
        <table class="items">
          <thead><tr><th>SKU</th><th>Qty</th><th>Per piece</th><th>Linear ft</th></tr></thead>
          <tbody>${lineRows}</tbody>
          <tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>${totalFt.toFixed(2)} ft</strong></td></tr></tfoot>
        </table>`;
    })
    .join("<br>");

  const pieceSections = wo.lines
    .map((line) => {
      const pieces = Array.from({ length: line.quantity }, (_, i) => i + 1);
      const grid =
        line.quantity <= 45
          ? `<div class="piece-grid">${pieces.map((p) => `<span class="piece">${p}</span>`).join("")}</div>`
          : pieces
              .reduce((rows: [number, number][], _, i) => {
                if (i % 5 === 0) rows.push([pieces[i], pieces[Math.min(i + 4, pieces.length - 1)]]);
                return rows;
              }, [])
              .map(([s, e]) => `<span class="piece">${s}–${e}</span>`)
              .join(" ");
      return `
        <div style="margin-bottom:12px">
          <div style="font-weight:600;margin-bottom:4px">${line.skuSnapshot} · ${line.materialName ?? ""} <span style="font-weight:400;color:#666">× ${line.quantity}</span>${line.isExpedited ? ' <span class="expedited-badge">Rush</span>' : ""}</div>
          ${grid}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${label}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 24px 32px; color: #111; }
  h1   { font-size: 18px; margin: 0 0 2px; }
  h2   { font-size: 13px; margin: 20px 0 8px; border-bottom: 2px solid #333; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  h3   { font-size: 11px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .header-right { text-align: right; font-size: 12px; font-weight: bold; }
  .meta { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 6px 16px; margin-bottom: 16px; padding: 10px; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; }
  .meta dt { font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
  .meta dd { margin: 0; font-size: 11px; }
  .expedited-badge { display: inline-block; background: #d32f2f; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.items th, table.items td { border: 1px solid #ddd; padding: 4px 8px; }
  table.items thead { background: #eee; }
  table.items th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
  .piece-grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .piece { display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border: 1px solid #ccc; font-size: 10px; border-radius: 2px; }
  .signoff { margin-top: 32px; border-top: 2px solid #333; padding-top: 12px; }
  .signoff table { font-size: 11px; }
  .signoff td { padding: 8px 0; }
  @media print { @page { size: letter; margin: 0.5in; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>${label}</h1>
    <p style="color:#555;margin:0">${wo.dueDate ? `Due ${wo.dueDate}` : "No due date set"}</p>
  </div>
  <div class="header-right">
    ${wo.isExpedited ? `<span class="expedited-badge">Expedited${wo.requestedDate ? ` · ${wo.requestedDate}` : ""}</span>` : ""}
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
<h2>Piece Tally</h2>
${pieceSections}
<div class="signoff">
  <table style="width:100%"><tr>
    <td>Completed by: _________________________</td>
    <td>Date: _________________________</td>
    <td>QC Initials: _______</td>
  </tr></table>
</div>
<script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;
}

// ── Label HTML ─────────────────────────────────────────────────

async function renderLabels(wo: WorkOrderFull, origin: string, lineIds?: Set<string>): Promise<string> {
  const orderNumber = wo.orderNumber ?? wo.orderId.slice(0, 8);
  const lines = lineIds ? wo.lines.filter((l) => lineIds.has(l.id)) : wo.lines;

  const labelPages: string[] = [];

  for (const line of lines) {
    for (let seq = 1; seq <= line.quantity; seq++) {
      const code  = traceCode(wo.id, line.id, seq, orderNumber);
      const url   = `${origin}/?order=${wo.orderId}&trace=${code}`;
      const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, width: 80 });

      labelPages.push(`
        <div class="label${line.isExpedited ? " expedited" : ""}">
          <div class="qr">${qrSvg}</div>
          <div class="info">
            <div class="sku">${line.skuSnapshot}</div>
            <div class="mat">${line.materialName ?? ""}${line.isExpedited ? ' <span class="rush">RUSH</span>' : ""}</div>
          </div>
        </div>`);
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Labels — ${orderNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; }
  .label {
    width: 3in; height: 1in;
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px;
    page-break-after: always;
    overflow: hidden;
  }
  .label:last-child { page-break-after: auto; }
  .qr { flex-shrink: 0; width: 80px; height: 80px; }
  .qr svg { width: 80px !important; height: 80px !important; }
  .info { flex: 1; min-width: 0; }
  .sku   { font-size: 11px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mat   { font-size: 9px; color: #555; margin-top: 2px; }
  .rush  { color: #d32f2f; font-weight: bold; font-size: 8px; text-transform: uppercase; }
  .label.expedited { border-left: 3px solid #d32f2f; }
  @media print {
    @page { size: 3in 1in; margin: 0; }
    body  { margin: 0; }
  }
</style>
</head>
<body>
${labelPages.join("\n")}
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
    const lineIds = linesParam ? new Set(linesParam.split(",").filter(Boolean)) : undefined;

    let html: string;
    if (type === "labels") {
      html = await renderLabels(wo, origin, lineIds);
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
