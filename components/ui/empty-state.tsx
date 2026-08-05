import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?:        React.ReactNode;
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  className?:   string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-[var(--space-8)] py-[var(--space-14)] text-center",
        className
      )}
    >
      {icon && (
        <div
          style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-5)" }}
        >
          {icon}
        </div>
      )}
      <p
        style={{
          fontSize:    "var(--text-md)",
          fontWeight:  "var(--weight-semibold)",
          color:       "var(--color-text-primary)",
          marginBottom: "var(--space-2)",
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color:    "var(--color-text-muted)",
            maxWidth: 320,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: "var(--space-6)" }}>{action}</div>
      )}
    </div>
  );
}
