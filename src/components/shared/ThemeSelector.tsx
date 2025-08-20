"use client";

import React from "react";
import { useAppStore, type ThemeType } from "@/store";
import styles from "./ThemeSelector.module.css";

const themes: { id: ThemeType; name: string; preview: { bg: string; accent: string } }[] = [
  {
    id: "light-orange",
    name: "Light Orange",
    preview: { bg: "#fdf8f2", accent: "#e89f71" }
  },
  {
    id: "light-blue",
    name: "Light Blue",
    preview: { bg: "#f8fbff", accent: "#71a8e8" }
  },
  {
    id: "dark-orange",
    name: "Dark Orange",
    preview: { bg: "#262624", accent: "#e89f71" }
  },
  {
    id: "dark-blue",
    name: "Dark Blue",
    preview: { bg: "#1a1f2e", accent: "#71a8e8" }
  }
];

export const ThemeSelector: React.FC = () => {
  const { currentTheme, setTheme } = useAppStore();

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Theme</h4>
      <div className={styles.themeGrid}>
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className={`${styles.themeOption} ${
              currentTheme === theme.id ? styles.active : ""
            }`}
          >
            <div
              className={styles.preview}
              style={{
                backgroundColor: theme.preview.bg,
                borderColor: theme.preview.accent,
              }}
            >
              <div
                className={styles.previewAccent}
                style={{ backgroundColor: theme.preview.accent }}
              />
            </div>
            <span className={styles.themeName}>{theme.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};