"use client";

import { HelpCircle } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

interface FieldHintProps {
  text: string;
}

export function FieldHint({ text }: FieldHintProps) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={text}
            style={{
              background: "none",
              border: "none",
              cursor: "help",
              color: "var(--color-text-muted)",
              padding: "0 var(--space-1)",
              display: "inline-flex",
              alignItems: "center",
              verticalAlign: "middle",
            }}
          >
            <HelpCircle size={13} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={4}
            style={{
              background: "var(--color-raised)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2) var(--space-3)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-primary)",
              maxWidth: 240,
              boxShadow: "var(--shadow-md)",
              zIndex: 100,
            }}
          >
            {text}
            <Tooltip.Arrow style={{ fill: "var(--color-border-default)" }} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
