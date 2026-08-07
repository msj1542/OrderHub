"use client";

import { useState, useActionState } from "react";
import { Eye } from "lucide-react";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Textarea }  from "@/components/ui/textarea";
import { Label }     from "@/components/ui/label";
import { Alert }     from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_DISPLAY } from "@/lib/authz/roles";
import type { Company } from "@/lib/db/schema";
import { saveCompanyAction } from "@/app/(app)/settings/companies/actions";

const PREVIEW_ROLES = ["external_admin", "external_ordering", "external_reference"] as const;

interface Props {
  companies: Company[];
  canPreview: boolean;
  enterPreviewAction: (companyId: string, companyName: string, roleCode: string) => Promise<void>;
}

export function CompanyManager({ companies, canPreview, enterPreviewAction }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(companies[0]?.id ?? null);
  const selected = companies.find((c) => c.id === selectedId);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "var(--space-4)", alignItems: "start" }}>
      <section style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
              Customers
            </p>
            <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0" }}>Companies</h2>
          </div>
          <Button size="sm" onClick={() => setSelectedId(null)}>+ New</Button>
        </div>
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 260px)" }}>
          {companies.length === 0 && (
            <p style={{ padding: "var(--space-5) var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", textAlign: "center" }}>
              No companies yet. Use &quot;+ New&quot; to add your first customer.
            </p>
          )}
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "var(--space-3) var(--space-4)",
                background: selectedId === c.id ? "var(--color-brand-subtle)" : "transparent",
                border: "none", borderBottom: "1px solid var(--color-border-subtle)", cursor: "pointer",
                color: selectedId === c.id ? "var(--color-brand)" : "var(--color-text-primary)",
                opacity: c.isActive ? 1 : 0.6,
              }}
            >
              <strong style={{ display: "block", fontSize: "var(--text-sm)" }}>{c.name}</strong>
              <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {c.orderScope === "own" ? "Own-order scope" : "Company-wide scope"}
                {!c.pricingVisible ? " · Pricing hidden" : ""}
              </span>
            </button>
          ))}
        </div>
      </section>

      <CompanyEditor
        key={selected?.id ?? "new-company"}
        company={selected}
        canPreview={canPreview}
        enterPreviewAction={enterPreviewAction}
      />
    </div>
  );
}

function CompanyEditor({ company, canPreview, enterPreviewAction }: {
  company?: Company;
  canPreview: boolean;
  enterPreviewAction: Props["enterPreviewAction"];
}) {
  const [state, action, pending] = useActionState(saveCompanyAction, {});
  const [previewRole, setPreviewRole] = useState<string>(PREVIEW_ROLES[0]);
  const [previewPending, setPreviewPending] = useState(false);

  return (
    <section style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
          Company profile
        </p>
        <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0" }}>
          {company ? `Edit ${company.name}` : "Create Company"}
        </h2>
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        {(state.error || state.success) && (
          <Alert variant={state.error ? "danger" : "success"} className="mb-4">{state.error ?? state.success}</Alert>
        )}

        <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {company && <input type="hidden" name="id" value={company.id} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
            <div>
              <Label htmlFor="co-name">Company name</Label>
              <Input id="co-name" name="name" required defaultValue={company?.name ?? ""} />
            </div>
            <div>
              <Label htmlFor="co-scope">Order scope</Label>
              <Select name="orderScope" defaultValue={company?.orderScope ?? "own"}>
                <SelectTrigger id="co-scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">Own — users see only their own orders</SelectItem>
                  <SelectItem value="company">Company — users see all company orders</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
            <div>
              <Label htmlFor="co-contact">Primary contact</Label>
              <Input id="co-contact" name="primaryContactName" defaultValue={company?.primaryContactName ?? ""} />
            </div>
            <div>
              <Label htmlFor="co-email">Contact email</Label>
              <Input id="co-email" name="contactEmail" type="email" defaultValue={company?.contactEmail ?? ""} />
            </div>
            <div>
              <Label htmlFor="co-phone">Contact phone</Label>
              <Input id="co-phone" name="contactPhone" defaultValue={company?.contactPhone ?? ""} />
            </div>
          </div>

          <div>
            <Label htmlFor="co-billing">Billing notes</Label>
            <Textarea id="co-billing" name="billingNotes" rows={2} defaultValue={company?.billingNotes ?? ""} placeholder="Terms, PO requirements, invoicing contact…" />
          </div>

          <div>
            <Label htmlFor="co-notes">Internal notes</Label>
            <Textarea id="co-notes" name="notes" rows={2} defaultValue={company?.notes ?? ""} />
          </div>

          <div style={{ display: "flex", gap: "var(--space-5)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
              <input type="hidden" name="pricingVisible" value="false" />
              <input type="checkbox" name="pricingVisible" value="true" defaultChecked={company?.pricingVisible ?? true} />
              Pricing visible to this company
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
              <input type="hidden" name="isActive" value="false" />
              <input type="checkbox" name="isActive" value="true" defaultChecked={company?.isActive ?? true} />
              Active
            </label>
          </div>

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : company ? "Save Company" : "Create Company"}
            </Button>
          </div>
        </form>

        {company && canPreview && (
          <div style={{ marginTop: "var(--space-8)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Eye size={16} /> Portal preview
            </h3>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-3)" }}>
              See exactly what this company sees. All mutations are blocked server-side while previewing.
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "end" }}>
              <div>
                <Label style={{ fontSize: "var(--text-xs)" }}>Role</Label>
                <Select value={previewRole} onValueChange={setPreviewRole}>
                  <SelectTrigger style={{ width: 200 }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PREVIEW_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_DISPLAY[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={previewPending}
                onClick={async () => {
                  setPreviewPending(true);
                  await enterPreviewAction(company.id, company.name, previewRole);
                }}
              >
                {previewPending ? "Entering…" : "Preview as this company"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
