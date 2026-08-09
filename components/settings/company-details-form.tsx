"use client";

import { useActionState } from "react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";
import { Alert }    from "@/components/ui/alert";
import type { Company } from "@/lib/db/schema";
import { saveCompanyDetailsAction } from "@/app/(app)/settings/company/actions";

export function CompanyDetailsForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState(saveCompanyDetailsAction, {});

  return (
    <section style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
          Company details
        </p>
        <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0" }}>{company.name}</h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "var(--space-2) 0 0" }}>
          Keep your contact info current — changes here are visible on our side too. To change your company name, contact your account rep.
        </p>
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        {(state.error || state.success) && (
          <Alert variant={state.error ? "danger" : "success"} className="mb-4">{state.error ?? state.success}</Alert>
        )}

        <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
            <div>
              <Label htmlFor="cd-contact">Primary contact</Label>
              <Input id="cd-contact" name="primaryContactName" defaultValue={company.primaryContactName ?? ""} />
            </div>
            <div>
              <Label htmlFor="cd-email">Contact email</Label>
              <Input id="cd-email" name="contactEmail" type="email" defaultValue={company.contactEmail ?? ""} />
            </div>
            <div>
              <Label htmlFor="cd-phone">Contact phone</Label>
              <Input id="cd-phone" name="contactPhone" defaultValue={company.contactPhone ?? ""} />
            </div>
          </div>

          <div>
            <Label htmlFor="cd-address">Address</Label>
            <Textarea id="cd-address" name="address" rows={2} defaultValue={company.address ?? ""} placeholder="Street, city, state, ZIP…" />
          </div>

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
