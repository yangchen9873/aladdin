/**
 * @fileoverview 主题偏好 Hook（localStorage + 系统偏好）。
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** 支持的主题 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/**
 * 从本地存储或系统偏好解析主题。
 * @returns 主题值
 */
function resolveTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * 把主题写到 `<html data-theme>`。
 * @param theme - 目标主题
 */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/**
 * 管理明暗主题状态。
 * @returns 当前主题与切换方法
 */
export function useTheme(): {
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => {
    const fromDom = document.documentElement.dataset.theme;

    if (fromDom === "light" || fromDom === "dark") return fromDom;

    return resolveTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  /**
   * 在 light / dark 间切换。
   * @returns 无返回值
   */
  const toggleTheme = () => {
    setThemeState((current) => (current === "light" ? "dark" : "light"));
  };

  return { theme, setTheme: setThemeState, toggleTheme };
}
