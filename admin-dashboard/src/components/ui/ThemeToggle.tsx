"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

const THEME_KEY = "yord-admin-theme";
const THEME_CHANGE_EVENT = "yord-admin-theme-change";

function getThemeSnapshot(): Theme | null {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function handleStorageChange(event: StorageEvent, callback: () => void) {
  if (event.key !== THEME_KEY) return;
  const theme = event.newValue === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  callback();
}

function subscribeTheme(callback: () => void) {
  const onStorage = (event: StorageEvent) => handleStorageChange(event, callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export default function ThemeToggle() {
  // A null server snapshot keeps markup hydration-safe. After hydration, the
  // pre-paint theme value becomes the snapshot and enables the control.
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => null);
  const ready = theme !== null;

  const toggle = useCallback(() => {
    if (theme === null) return;
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // The chosen theme remains active for this page.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, [theme]);

  return (
    <button
      type="button"
      className="button icon-button small"
      onClick={toggle}
      disabled={!ready}
      aria-label={!ready ? "Theme" : theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={!ready ? "Theme" : theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {ready && (theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />)}
    </button>
  );
}
