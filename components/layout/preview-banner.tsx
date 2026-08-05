"use client";

import { Eye } from "lucide-react";
import { ROLE_DISPLAY, type RoleCode } from "@/lib/authz/roles";
import type { PreviewContext } from "@/lib/auth";

interface PreviewBannerProps {
  preview:    PreviewContext;
  exitAction: () => Promise<void>;
}

export function PreviewBanner({ preview, exitAction }: PreviewBannerProps) {
  const roleLabel = ROLE_DISPLAY[preview.roleCode as RoleCode] ?? preview.roleCode;

  return (
    <div
      style={{
        background:   "var(--status-warning-bg)",
        borderBottom: "1px solid var(--status-warning-border)",
        color:        "var(--status-warning-text)",
        padding:      "var(--space-3) var(--space-5)",
        fontSize:     "var(--text-xs)",
        display:      "flex",
        alignItems:   "center",
        gap:          "var(--space-3)",
        flexShrink:   0,
      }}
    >
      <Eye size={13} strokeWidth={2} />
      <span style={{ flex: 1, fontWeight: "var(--weight-medium)" }}>
        Previewing as <strong>{roleLabel}</strong> — {preview.companyName}
      </span>
      {/* Server Action via form so it works without JS and avoids onClick-with-Promise */}
      <form action={exitAction} style={{ margin: 0 }}>
        <button
          type="submit"
          style={{
            background: "transparent",
            border:     "none",
            cursor:     "pointer",
            color:      "inherit",
            fontWeight: "var(--weight-medium)",
            fontSize:   "var(--text-xs)",
            padding:    "0 var(--space-2)",
          }}
        >
          Exit preview
        </button>
      </form>
    </div>
  );
}
