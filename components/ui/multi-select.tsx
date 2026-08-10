"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type MultiSelectOption = { id: string; label: string };

interface MultiSelectProps {
  options:      MultiSelectOption[];
  selectedIds:  string[];
  onChange:     (ids: string[]) => void;
  placeholder?: string;
  emptyText?:   string;
}

/**
 * Searchable multi-select with removable chips — no equivalent existed in
 * the design system before this (Select is single-value, Radix Popover
 * isn't a dependency). Follows the same "input + inline list below it, no
 * portal" convention already used for the New Order catalog search
 * (components/orders/new-order.tsx) rather than introducing a new
 * floating-UI pattern.
 */
export function MultiSelect({ options, selectedIds, onChange, placeholder = "Search…", emptyText = "No matches" }: MultiSelectProps) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.filter((o) => selectedIds.includes(o.id));
  const filtered = options.filter(
    (o) => !selectedIds.includes(o.id) && o.label.toLowerCase().includes(query.toLowerCase()),
  );

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(true)}
        style={{
          display:      "flex",
          flexWrap:     "wrap",
          alignItems:   "center",
          gap:          "var(--space-2)",
          minHeight:    36,
          padding:      "var(--space-2) var(--space-3)",
          border:       "1px solid var(--color-border-default)",
          borderRadius: "var(--radius-md)",
          background:   "var(--color-panel)",
          boxShadow:    "var(--shadow-sm)",
          cursor:       "text",
        }}
      >
        {selected.map((o) => (
          <Badge key={o.id} variant="info" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {o.label}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(o.id); }}
              aria-label={`Remove ${o.label}`}
              style={{ display: "inline-flex", background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}
            >
              <X size={11} />
            </button>
          </Badge>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ""}
          style={{
            flex:       1,
            minWidth:   120,
            border:     "none",
            outline:    "none",
            fontSize:   "var(--text-sm)",
            background: "transparent",
            color:      "var(--color-text-primary)",
          }}
        />
      </div>

      {open && (
        <div
          style={{
            position:     "absolute",
            top:          "calc(100% + 4px)",
            left:         0,
            right:        0,
            zIndex:       20,
            background:   "var(--color-panel)",
            border:       "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow:    "var(--shadow-md)",
            maxHeight:    220,
            overflowY:    "auto",
          }}
        >
          {filtered.length === 0 ? (
            <p style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
              {emptyText}
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className="hover:bg-[var(--color-sunken)] transition-colors"
                style={{
                  display:    "block",
                  width:      "100%",
                  textAlign:  "left",
                  padding:    "var(--space-2) var(--space-4)",
                  fontSize:   "var(--text-sm)",
                  border:     "none",
                  background: "transparent",
                  cursor:     "pointer",
                  color:      "var(--color-text-primary)",
                }}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
