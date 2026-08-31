/**
 * @fileoverview UI 数值格式化工具。
 */

/**
 * 将 token 数量格式化为紧凑单位。
 * @param value - token 数量
 * @returns 适合窄空间展示的字符串
 */
export function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}m`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }

  return value.toString();
}

/**
 * 将 0-1 比例格式化为百分比。
 * @param value - 比例值
 * @returns 保留一位小数的百分比
 */
export function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * 将毫秒耗时格式化为适合标题行展示的单位。
 * @param durationMs - 耗时毫秒数
 * @returns 分钟、秒或毫秒文本
 */
export function formatDuration(durationMs: number): string {
  if (durationMs >= 60_000) return `${Math.round((durationMs / 60_000) * 10) / 10} min`;
  if (durationMs >= 1_000) return `${Math.round((durationMs / 1_000) * 10) / 10} s`;

  return `${durationMs} ms`;
}
