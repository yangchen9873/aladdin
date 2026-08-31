/**
 * @fileoverview 前端解压服务端下发的 gzip Base64（fflate 同步 gunzip）。
 */

import { gunzipSync, strFromU8 } from "fflate";

/**
 * 将 gzip Base64 解压为 UTF-8 文本。
 * @param encoded - Base64 压缩串
 * @returns 原文
 */
export function decompressGzipBase64(encoded: string): string {
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));

  return strFromU8(gunzipSync(bytes));
}

/**
 * 解压可空的 gzip Base64。
 * @param encoded - Base64 或空
 * @returns 原文或 undefined
 */
export function decompressGzipBase64Optional(encoded: string | undefined): string | undefined {
  if (encoded === undefined) return undefined;

  return decompressGzipBase64(encoded);
}
