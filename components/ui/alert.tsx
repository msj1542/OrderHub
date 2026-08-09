"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const STYLES: Record<AlertVariant, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  info: {
    bg: "var(--status-info-bg)",
    border: "var(--status-info-border)",
    color: "var(--status-info-text)",
    icon: <Info size={15} />,
  },
  success: {
    bg: "var(--status-success-bg)",
    border: "var(--status-success-border)",
    color: "var(--status-success-text)",
    icon: <CheckCircle2 size={15} />,
  },
  warning: {
    bg: "var(--status-warning-bg)",
    border: "var(--status-warning-border)",
    color: "var(--status-warning-text)",
    icon: <AlertCircle size={15} />,
  },
  danger: {
    bg: "var(--status-danger-bg)",
    border: "var(--status-danger-border)",
    color: "var(--status-danger-text)",
    icon: <XCircle size={15} />,
  },
};

export function Alert({ variant = "info", title, children, className }: AlertProps) {
  const s = STYLES[variant];
  return (
    <div
      role="alert"
      className={cn("rounded-[var(--radius-md)] p-4", className)}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
      }}
    >
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <span style={{ flexShrink: 0, marginTop: "1px" }}>{s.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <p
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-semibold)",
                marginBottom: children ? "var(--space-1)" : 0,
              }}
            >
              {title}
            </p>
          )}
          <div style={{ fontSize: "var(--text-sm)" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
