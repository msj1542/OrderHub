import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-brand)] text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-hover)]",
        secondary:
          "bg-[var(--color-panel)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:bg-[var(--color-sunken)]",
        danger:
          "bg-[var(--status-danger-text)] text-white hover:opacity-90",
        success:
          "bg-[var(--status-success-text)] text-white hover:opacity-90",
        ghost:
          "bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-sunken)]",
        link: "bg-transparent text-[var(--color-brand)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        md: "h-9 px-4 text-[var(--text-base)]",
        sm: "h-7 px-3 text-[var(--text-sm)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the single child element instead of a <button> (e.g. wrap a <Link>). */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
