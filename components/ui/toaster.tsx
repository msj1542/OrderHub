"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { useToast, dismiss } from "@/lib/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map(({ id, title, description, variant }) => {
        const isSuccess = variant === "success";
        const isDanger  = variant === "danger";
        return (
          <ToastPrimitive.Root
            key={id}
            open
            onOpenChange={(open) => { if (!open) dismiss(id); }}
            style={{
              background:   isDanger  ? "var(--status-danger-bg)"
                          : isSuccess ? "var(--status-success-bg)"
                          : "var(--color-panel)",
              border: `1px solid ${
                isDanger  ? "var(--status-danger-border)"
                : isSuccess ? "var(--status-success-border)"
                : "var(--color-border-default)"
              }`,
              borderRadius: "var(--radius-lg)",
              boxShadow:    "var(--shadow-lg)",
              padding:      "var(--space-5) var(--space-6)",
              display:      "flex",
              alignItems:   "flex-start",
              gap:          "var(--space-4)",
              minWidth:     300,
              maxWidth:     420,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <ToastPrimitive.Title
                style={{
                  fontSize:   "var(--text-base)",
                  fontWeight: "var(--weight-semibold)",
                  color:      isDanger  ? "var(--status-danger-text)"
                              : isSuccess ? "var(--status-success-text)"
                              : "var(--color-text-primary)",
                }}
              >
                {title}
              </ToastPrimitive.Title>
              {description && (
                <ToastPrimitive.Description
                  style={{
                    fontSize:  "var(--text-sm)",
                    color:     "var(--color-text-muted)",
                    marginTop: "var(--space-1)",
                  }}
                >
                  {description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss notification"
              style={{
                background: "transparent",
                border:     "none",
                cursor:     "pointer",
                color:      "var(--color-text-muted)",
                padding:    0,
                display:    "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        style={{
          position:      "fixed",
          bottom:        "var(--space-6)",
          right:         "var(--space-6)",
          display:       "flex",
          flexDirection: "column",
          gap:           "var(--space-3)",
          zIndex:        100,
          outline:       "none",
          listStyle:     "none",
          margin:        0,
          padding:       0,
        }}
      />
    </ToastPrimitive.Provider>
  );
}
