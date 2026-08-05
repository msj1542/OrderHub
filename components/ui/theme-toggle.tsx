"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial =
      saved ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial as "light" | "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  // Suppress render until theme is read from localStorage to avoid flicker.
  if (!theme) return <div style={{ width: 32, height: 32 }} />;

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      style={{
        background:    "transparent",
        border:        "none",
        cursor:        "pointer",
        color:         "var(--color-text-muted)",
        display:       "flex",
        alignItems:    "center",
        justifyContent: "center",
        width:         32,
        height:        32,
        borderRadius:  "var(--radius-md)",
        flexShrink:    0,
      }}
      className="hover:bg-[var(--color-sunken)] hover:text-[var(--color-text-primary)] transition-colors"
    >
      {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
    </button>
  );
}
