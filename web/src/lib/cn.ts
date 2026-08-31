/**
 * @fileoverview 类名合并工具（clsx + tailwind-merge）。
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并条件类名，并正确处理 Tailwind 冲突。
 * @param inputs - 类名片段
 * @returns 合并后的 className
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
