"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * MasterDetail — responsive list+detail layout.
 *
 * On wide viewports: list panel on the left, detail panel on the right.
 * On narrow viewports: only one panel is visible at a time.
 *
 * The parent controls `selectedId` via URL search params (e.g. ?id=xxx).
 * When selectedId is set on mobile, the detail panel slides in.
 */
export function MasterDetail({
  list,
  detail,
  hasSelection,
  className,
}: {
  list:         React.ReactNode;
  detail:       React.ReactNode;
  hasSelection: boolean;
  className?:   string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 gap-0", className)}>
      {/* List panel */}
      <div
        className={cn(
          "flex flex-col min-h-0 overflow-auto border-r border-[var(--color-border-subtle)]",
          "w-full md:w-[380px] lg:w-[420px] shrink-0",
          hasSelection ? "hidden md:flex" : "flex",
        )}
      >
        {list}
      </div>

      {/* Detail panel */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-0 overflow-auto",
          hasSelection ? "flex" : "hidden md:flex",
        )}
      >
        {detail}
      </div>
    </div>
  );
}
