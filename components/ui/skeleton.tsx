import { cn } from "@/lib/utils";

/** Pulsing placeholder block for loading states. Compose into route-level `loading.tsx` files. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-md)]", className)}
      style={{ background: "var(--color-sunken)", ...style }}
    />
  );
}
