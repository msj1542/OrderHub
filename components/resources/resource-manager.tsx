"use client";

import { useState, useActionState } from "react";
import { FolderOpen } from "lucide-react";
import { Button }     from "@/components/ui/button";
import { Input }      from "@/components/ui/input";
import { Textarea }   from "@/components/ui/textarea";
import { Label }      from "@/components/ui/label";
import { Alert }      from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ResourceCategory, ResourceWithVersion } from "@/lib/db/schema";
import {
  saveCategoryAction, saveResourceAction, uploadResourceVersionAction,
} from "@/app/(app)/settings/resources/actions";

interface Props {
  categories: ResourceCategory[];
  resources:  ResourceWithVersion[];
}

export function ResourceManager({ categories, resources }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(resources[0]?.id ?? null);
  const selected = resources.find((r) => r.id === selectedId);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "var(--space-4)", alignItems: "start" }}>
      {/* List + category management */}
      <section
        style={{
          background: "var(--color-panel)", border: "1px solid var(--color-border-default)",
          borderRadius: "var(--radius-lg)", overflow: "hidden",
        }}
      >
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
            Resource library
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0" }}>Documents</h2>
            <Button size="sm" onClick={() => setSelectedId(null)}>+ New</Button>
          </div>
        </div>

        <div style={{ overflowY: "auto", maxHeight: 400 }}>
          {resources.length === 0 && (
            <p style={{ padding: "var(--space-6)", textAlign: "center", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              No resources yet
            </p>
          )}
          {resources.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "var(--space-3) var(--space-4)",
                background: selectedId === r.id ? "var(--color-brand-subtle)" : "transparent",
                border: "none", borderBottom: "1px solid var(--color-border-subtle)", cursor: "pointer",
                color: selectedId === r.id ? "var(--color-brand)" : "var(--color-text-primary)",
                opacity: r.isActive ? 1 : 0.6,
              }}
            >
              <strong style={{ display: "block", fontSize: "var(--text-sm)" }}>{r.title}</strong>
              <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {r.categoryName}{r.pricingRestricted ? " · Pricing-restricted" : ""}
              </span>
            </button>
          ))}
        </div>

        <CategoryPanel categories={categories} />
      </section>

      {/* Editor */}
      <ResourceEditor key={selected?.id ?? "new-resource"} resource={selected} categories={categories} />
    </div>
  );
}

// ── Category management ─────────────────────────────────────────

function CategoryPanel({ categories }: { categories: ResourceCategory[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveCategoryAction, {});

  return (
    <div style={{ borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--space-4)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", padding: 0 }}
      >
        {open ? "▾" : "▸"} Manage categories
      </button>
      {open && (
        <div style={{ marginTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {categories.map((c) => (
            <span key={c.id} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              {c.name}{c.pricingRestricted ? " (pricing-restricted)" : ""}
            </span>
          ))}
          <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <Input name="name" placeholder="New category name" required style={{ height: 28, fontSize: "var(--text-xs)" }} />
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-xs)", cursor: "pointer" }}>
              <input type="hidden" name="pricingRestricted" value="false" />
              <input type="checkbox" name="pricingRestricted" value="true" />
              Pricing-restricted
            </label>
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              {pending ? "Adding…" : "+ Add Category"}
            </Button>
          </form>
          {(state.error || state.success) && (
            <Alert variant={state.error ? "danger" : "success"}>{state.error ?? state.success}</Alert>
          )}
        </div>
      )}
    </div>
  );
}

// ── Resource editor ──────────────────────────────────────────────

function ResourceEditor({ resource, categories }: { resource?: ResourceWithVersion; categories: ResourceCategory[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveResourceAction, {});
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadResourceVersionAction, {});

  if (categories.length === 0) {
    return (
      <div style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-10)" }}>
        <EmptyState icon={<FolderOpen size={28} />} title="No categories yet" description="Add a category from the list panel before creating resources." />
      </div>
    );
  }

  return (
    <section style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
          Resource profile
        </p>
        <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0" }}>
          {resource ? `Edit ${resource.title}` : "Create Resource"}
        </h2>
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        {(saveState.error || saveState.success) && (
          <Alert variant={saveState.error ? "danger" : "success"} className="mb-4">{saveState.error ?? saveState.success}</Alert>
        )}

        <form action={saveAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {resource && <input type="hidden" name="id" value={resource.id} />}

          <div>
            <Label htmlFor="res-title">Title</Label>
            <Input id="res-title" name="title" required defaultValue={resource?.title ?? ""} placeholder="2024 Price List" />
          </div>

          <div>
            <Label htmlFor="res-desc">Description</Label>
            <Textarea id="res-desc" name="description" rows={2} defaultValue={resource?.description ?? ""} placeholder="Optional context shown next to the download link…" />
          </div>

          <div>
            <Label htmlFor="res-category">Category</Label>
            <Select name="categoryId" defaultValue={resource?.categoryId ?? categories[0]?.id}>
              <SelectTrigger id="res-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
              <input type="hidden" name="isActive" value="false" />
              <input type="checkbox" name="isActive" value="true" defaultChecked={resource?.isActive ?? true} />
              Active
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
              <input type="hidden" name="customerVisible" value="false" />
              <input type="checkbox" name="customerVisible" value="true" defaultChecked={resource?.customerVisible ?? true} />
              Customer-visible
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
              <input type="hidden" name="pricingRestricted" value="false" />
              <input type="checkbox" name="pricingRestricted" value="true" defaultChecked={resource?.pricingRestricted ?? false} />
              Pricing-restricted
            </label>
          </div>

          <div>
            <Button type="submit" disabled={savePending}>
              {savePending ? "Saving…" : resource ? "Save Resource" : "Create Resource"}
            </Button>
          </div>
        </form>

        {resource && (
          <div style={{ marginTop: "var(--space-8)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-3)" }}>
              File version
            </h3>

            {resource.currentVersion ? (
              <p style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
                Current: <strong>{resource.currentVersion.fileName}</strong>
                {resource.currentVersion.version ? ` (v${resource.currentVersion.version})` : ""}
                {" · "}
                <a href={`/api/resources/${resource.currentVersion.id}`} style={{ color: "var(--color-brand)" }}>Download</a>
              </p>
            ) : (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
                No file uploaded yet.
              </p>
            )}

            <form action={uploadAction} style={{ display: "flex", gap: "var(--space-3)", alignItems: "end", flexWrap: "wrap" }}>
              <input type="hidden" name="resourceId" value={resource.id} />
              <div>
                <Label style={{ fontSize: "var(--text-xs)" }}>Version label (optional)</Label>
                <Input name="version" placeholder="2024.1" style={{ width: 140 }} />
              </div>
              <div>
                <Label style={{ fontSize: "var(--text-xs)" }}>File</Label>
                <input type="file" name="file" required />
              </div>
              <Button type="submit" size="sm" variant="secondary" disabled={uploadPending}>
                {uploadPending ? "Uploading…" : "Upload New Version"}
              </Button>
            </form>
            {(uploadState.error || uploadState.success) && (
              <Alert variant={uploadState.error ? "danger" : "success"} className="mt-3">
                {uploadState.error ?? uploadState.success}
              </Alert>
            )}

            {resource.versionCount > 1 && (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-3)" }}>
                {resource.versionCount} versions on file — uploading a new one sets it as current.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
