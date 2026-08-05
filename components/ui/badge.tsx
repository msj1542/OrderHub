import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-pill)] border px-[var(--space-4)] py-[var(--space-1)] text-[var(--text-xs)] font-[var(--weight-medium)] transition-colors",
  {
    variants: {
      variant: {
        default:   "border-[var(--color-border-default)] bg-[var(--color-panel)] text-[var(--color-text-primary)]",
        neutral:   "border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
        info:      "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
        success:   "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
        warning:   "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
        danger:    "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
        urgent:    "border-[var(--status-urgent-border)] bg-[var(--status-urgent-bg)] text-[var(--status-urgent-text)]",
        completed: "border-[var(--status-completed-border)] bg-[var(--status-completed-bg)] text-[var(--status-completed-text)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
