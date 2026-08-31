/**
 * @fileoverview 工具调用详情 API。
 */

import type { ToolCall } from "../types/chat";
import { requestJson } from "./http";

/** 工具调用详情 */
export type ToolCallDetail = ToolCall & {
  conversationId: string;
  assistantMessageId: string;
  startedAt: number;
  finishedAt: number | null;
};

/**
 * 拉取单次工具调用的完整出入参。
 * @param toolCallId - tool_calls 主键
 * @returns 已转换为前端模型的工具调用详情
 * @throws {Error} 请求失败或工具调用不存在时抛出异常
 */
export async function getToolCall(toolCallId: string): Promise<ToolCallDetail> {
  const body = await requestJson<{
    id: string;
    conversationId: string;
    assistantMessageId: string;
    name: string;
    arguments: unknown;
    result: string | null;
    details: unknown;
    status: ToolCall["status"];
    error?: string;
    durationMs: number | null;
    startedAt: number;
    finishedAt: number | null;
  }>(`/api/tool-calls/${toolCallId}`);

  return {
    toolCallId: body.id,
    id: body.id,
    name: body.name,
    arguments: body.arguments,
    result: body.result,
    details: body.details,
    status: body.status,
    error: body.error,
    durationMs: body.durationMs,
    conversationId: body.conversationId,
    assistantMessageId: body.assistantMessageId,
    startedAt: body.startedAt,
    finishedAt: body.finishedAt,
  };
}
