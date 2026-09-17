"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  // Lazy initializer reads external store (localStorage) once; effect below only writes DOM.
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof window !== "undefined" && window.localStorage.getItem("yord-admin-theme") === "light"
      ? "light"
      : "dark"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      window.localStorage.setItem("yord-admin-theme", next);
      return next;
    });
  }, []);

  return (
    <button
      type="button"
      className="button icon-button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
