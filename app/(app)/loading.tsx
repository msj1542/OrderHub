import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading state for every page inside the (app) shell.
 * Next.js renders this automatically while a page's RSC data fetch is in
 * flight, so navigation gets instant visual feedback instead of a blank
 * canvas — the sidebar/topbar (in the parent layout) stay interactive.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Skeleton style={{ height: 28, width: 220 }} />
      <Skeleton style={{ height: 140 }} />
      <div className="flex flex-col gap-[var(--space-2)]">
        <Skeleton style={{ height: 44 }} />
        <Skeleton style={{ height: 44 }} />
        <Skeleton style={{ height: 44 }} />
        <Skeleton style={{ height: 44 }} />
      </div>
    </div>
  );
}
