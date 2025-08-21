"use client";

import React from "react";
import { useAppStore, type ThemeType } from "@/store";
import styles from "./ThemeSelector.module.css";

const themes: { id: ThemeType; name: string; preview: { bg: string; accent: string } }[] = [
  {
    id: "light-orange",
    name: "Autumn Glow",
    preview: { bg: "#fdf8f2", accent: "#e89f71" }
  },
  {
    id: "dark-orange",
    name: "Ember Night",
    preview: { bg: "#262624", accent: "#e89f71" }
  },
  {
    id: "light-blue",
    name: "Ocean Breeze",
    preview: { bg: "#f8fbff", accent: "#71a8e8" }
  },
  {
    id: "dark-blue",
    name: "Midnight Storm",
    preview: { bg: "#1a1f2e", accent: "#71a8e8" }
  },
  {
    id: "light-pink",
    name: "Sakura Blossom",
    preview: { bg: "#fdf9fa", accent: "#c97694" }
  },
  {
    id: "dark-pink",
    name: "Midnight Rose",
    preview: { bg: "#2a2428", accent: "#c97694" }
  },
  {
    id: "light-green",
    name: "Forest Dawn",
    preview: { bg: "#f7fef7", accent: "#71e871" }
  },
  {
    id: "dark-green",
    name: "Deep Forest",
    preview: { bg: "#242a24", accent: "#6bc46b" }
  },
  {
    id: "light-purple",
    name: "Amethyst Dawn",
    preview: { bg: "#fdf9ff", accent: "#a271c8" }
  },
  {
    id: "dark-purple",
    name: "Royal Night",
    preview: { bg: "#2a252f", accent: "#a271c8" }
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