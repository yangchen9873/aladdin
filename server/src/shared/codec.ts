/**
 * @fileoverview 长文本 gzip 压缩，bytea 存储；HTTP 用 Base64 原样下发压缩字节。
 * 无内容写 NULL（与 DDL bytea 可空约定一致）。
 */

import { gunzipSync, gzipSync } from "node:zlib";

/**
 * 文本 gzip 压缩。null/空串写 NULL。
 * @param value - 原文
 * @returns gzip 字节；无内容时为 null
 */
export function compressText(value: string | null | undefined): Buffer | null {
  if (value == null || value === "") return null;

  return gzipSync(Buffer.from(value, "utf8"));
}

/**
 * gzip 解压为文本。仅服务端拼模型上下文时使用。
 * @param value - 压缩字节
 * @returns 原文；无内容时为空串
 */
export function decompressText(value: Buffer | Uint8Array | null | undefined): string {
  if (value == null) return "";

  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);

  if (bytes.length === 0) return "";

  return gunzipSync(bytes).toString("utf8");
}

/**
 * 压缩字节转 Base64，供 JSON 传给前端自行解压。
 * @param value - gzip 字节
 * @returns Base64；无内容时返回 null（前端可省略该字段）
 */
export function bytesToBase64(value: Buffer | Uint8Array | null | undefined): string | null {
  if (value == null) return null;

  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);

  if (bytes.length === 0) return null;

  return bytes.toString("base64");
}
