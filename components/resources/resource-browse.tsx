"use client";

import { FileText, Download, Eye, FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge }       from "@/components/ui/badge";
import type { ResourceCategory, ResourceWithVersion } from "@/lib/db/schema";

interface Props {
  categories: ResourceCategory[];
  resources:  ResourceWithVersion[];
}

export function ResourceBrowse({ categories, resources }: Props) {
  const downloadable = resources.filter((r) => r.currentVersion);

  if (downloadable.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen size={32} strokeWidth={1.5} />}
        title="No resources available"
        description="Documents uploaded by the team will show up here, organized by category."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {categories.map((category) => {
        const items = downloadable.filter((r) => r.categoryId === category.id);
        if (items.length === 0) return null;

        return (
          <section key={category.id}>
            <h2 className="text-[var(--text-base)] font-[var(--weight-semibold)] mb-[var(--space-3)]">
              {category.name}
            </h2>
            <div className="grid gap-[var(--space-3)]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {items.map((r) => (
                <a
                  key={r.id}
                  href={`/api/resources/${r.currentVersion!.id}`}
                  target={r.downloadable ? undefined : "_blank"}
                  rel={r.downloadable ? undefined : "noopener noreferrer"}
                  className="flex items-start gap-[var(--space-3)] p-[var(--space-4)] rounded-[var(--radius-md)] border transition-colors"
                  style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-panel)", textDecoration: "none", color: "inherit" }}
                >
                  <FileText size={18} className="shrink-0 mt-[2px]" style={{ color: "var(--color-text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <p className="text-[var(--text-sm)] font-[var(--weight-medium)] truncate">{r.title}</p>
                      {r.pricingRestricted && <Badge variant="warning">Pricing</Badge>}
                      {!r.downloadable && <Badge variant="neutral">View only</Badge>}
                    </div>
                    {r.description && (
                      <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-[var(--space-1)]">{r.description}</p>
                    )}
                  </div>
                  {r.downloadable
                    ? <Download size={14} className="shrink-0 mt-[2px]" style={{ color: "var(--color-text-muted)" }} />
                    : <Eye size={14} className="shrink-0 mt-[2px]" style={{ color: "var(--color-text-muted)" }} />}
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
