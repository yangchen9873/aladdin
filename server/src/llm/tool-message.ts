/**
 * @fileoverview 工具消息在会话恢复时的最小摘要。
 */

import type { ToolCallStatus } from "../db/tool-calls.js";

/** 工具摘要；完整输入输出通过 tool_calls 详情接口获取。 */
export type StoredToolMessage = {
  /** 对应 tool_calls.id，详情接口用 */
  toolCallId: string;
  name: string;
  status: ToolCallStatus;
  error?: string | null;
  durationMs?: number | null;
};

/**
 * 页面回显字段（不含 result）。
 * @param row - 落库 JSON
 * @returns 前端工具调用摘要对象
 */
export function toToolCallSummary(row: StoredToolMessage) {
  return {
    toolCallId: row.toolCallId,
    name: row.name,
    status: row.status,
    error: row.error ?? undefined,
    durationMs: row.durationMs ?? undefined,
  };
}
