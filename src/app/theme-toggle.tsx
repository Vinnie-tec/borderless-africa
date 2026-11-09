"use client";

import { useEffect, useSyncExternalStore } from "react";
import styles from "./theme-toggle.module.scss";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "borderless-africa-theme";
const listeners = new Set<() => void>();

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

function subscribeToTheme(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getThemeSnapshot(): Theme {
  const activeTheme = document.documentElement.dataset.theme;

  if (isTheme(activeTheme)) {
    return activeTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  listeners.forEach((listener) => listener());
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    let savedTheme: string | null = null;

    try {
      savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to read the saved theme preference.", error);
    }

    const initialTheme = isTheme(savedTheme)
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    applyTheme(initialTheme);

    if (!isTheme(savedTheme)) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const updateFromSystem = (event: MediaQueryListEvent) => {
        let currentPreference: string | null = null;

        try {
          currentPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
        } catch (error) {
          console.warn("Unable to read the saved theme preference.", error);
        }

        if (!isTheme(currentPreference)) {
          const systemTheme = event.matches ? "dark" : "light";
          applyTheme(systemTheme);
        }
      };

      mediaQuery.addEventListener("change", updateFromSystem);
      return () => mediaQuery.removeEventListener("change", updateFromSystem);
    }
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      console.warn("Unable to save the theme preference.", error);
    }
  }

  return (
    <button
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      className={styles.toggle}
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={styles.icon}
        fill="none"
        viewBox="0 0 20 20"
      >
        <path
          className={styles.moon}
          d="M15.8 12.3A6.2 6.2 0 0 1 7.7 4.2a6.3 6.3 0 1 0 8.1 8.1Z"
        />
        <g className={styles.sun}>
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 1.8v1.5M10 16.7v1.5M18.2 10h-1.5M3.3 10H1.8M15.8 4.2l-1.1 1.1M5.3 14.7l-1.1 1.1M15.8 15.8l-1.1-1.1M5.3 5.3 4.2 4.2" />
        </g>
      </svg>
    </button>
  );
}
