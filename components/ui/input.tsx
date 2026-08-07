import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClick, ...props }, ref) => {
    const handleClick: React.MouseEventHandler<HTMLInputElement> = (e) => {
      if (type === "date") {
        try { (e.target as HTMLInputElement).showPicker(); } catch {}
      }
      onClick?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-panel)] px-3 py-1 text-[var(--text-base)] text-[var(--color-text-primary)] shadow-sm transition-colors placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-50",
          type === "date" && "cursor-pointer",
          className
        )}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
