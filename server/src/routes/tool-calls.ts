/**
 * @fileoverview GET /api/tool-calls/:id —— 工具调用完整出入参。
 */

import type { Context } from "hono";
import { validate as isUuid } from "uuid";
import { getToolCallDetail } from "../db/tool-calls.js";

/**
 * 查询工具调用详情并转换为前端使用的驼峰字段。
 *
 * @param c - Hono context
 * @returns 工具调用详情，或参数错误/资源不存在响应
 */
export async function getToolCallHandler(c: Context) {
  const id = c.req.param("id");

  if (!id || !isUuid(id)) {
    return c.json({ error: "id is invalid" }, 400);
  }

  const detail = await getToolCallDetail(id);

  if (!detail) {
    return c.json({ error: "tool call not found" }, 404);
  }

  return c.json({
    id: detail.tool_calls_id,
    conversationId: detail.conversations_id,
    assistantMessageId: detail.messages_id,
    name: detail.tool_name,
    arguments: detail.arguments,
    result: detail.result_content,
    details: detail.result_details,
    status: detail.status,
    error: detail.error_message || undefined,
    durationMs: detail.duration_ms,
    startedAt: detail.started_at.getTime(),
    finishedAt: detail.finished_at?.getTime() ?? null,
  });
}
