/**
 * @fileoverview 会话列表 / 详情 / 删除。
 */

import type { Context } from "hono";
import type { Api, Model } from "@earendil-works/pi-ai";
import { validate as isUuid } from "uuid";
import { bytesToBase64 } from "../shared/codec.js";
import { decodeMessage } from "../db/messages.js";
import {
  deleteConversation,
  getConversationUsage,
  listConversationMessages,
  listConversations,
} from "../db/conversations.js";
import { toToolCallSummary } from "../llm/tool-message.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * GET /api/conversations
 * @param c - Hono 请求上下文
 * @returns 会话列表与下一页游标
 */
export async function listConversationsHandler(c: Context) {
  const cursor = c.req.query("cursor") ?? null;
  const limitParam = c.req.query("limit");

  if (cursor !== null && !isUuid(cursor)) {
    return c.json({ error: "cursor is invalid" }, 400);
  }

  const limit = limitParam === undefined ? DEFAULT_PAGE_SIZE : Number(limitParam);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    return c.json({ error: "limit must be an integer between 1 and 100" }, 400);
  }

  const page = await listConversations(cursor, limit);

  return c.json({
    conversations: page.rows.map((row) => ({
      id: row.conversations_id,
      title: row.title,
      createdAt: new Date(row.created_at).getTime(),
    })),
    nextCursor: page.nextCursor,
  });
}

/**
 * GET /api/conversations/:id —— 按 messages 时间线回显，tool 摘要挂在助手消息下。
 * @param c - Hono 请求上下文
 * @param model - 当前文本模型，用于计算用量 context_ratio
 * @returns 消息时间线与 token 用量汇总
 */
export async function getConversationHandler(c: Context, model: Model<Api>) {
  const id = c.req.param("id");

  if (!id || !isUuid(id)) {
    return c.json({ error: "id is invalid" }, 400);
  }

  const rawMessages = await listConversationMessages(id);
  const usage = await getConversationUsage(id, model.contextWindow);
  const timeline = rawMessages.map(decodeMessage);
  const toolCallsByParent = new Map<string, ReturnType<typeof toToolCallSummary>[]>();

  for (let index = 0; index < timeline.length; index++) {
    const message = timeline[index];

    if (!message) continue;

    if (
      message.role !== "tool" ||
      !message.parent_message_id ||
      !message.tool_calls_id ||
      !message.tool_name
    ) {
      continue;
    }

    const calls = toolCallsByParent.get(message.parent_message_id) ?? [];
    calls.push(
      toToolCallSummary({
        toolCallId: message.tool_calls_id,
        name: message.tool_name,
        status: (message.tool_status || "running") as "running" | "done" | "error" | "aborted",
        error: message.error_message || undefined,
        durationMs: message.tool_duration_ms ?? undefined,
      }),
    );
    toolCallsByParent.set(message.parent_message_id, calls);
  }

  const messages: {
    id: string;
    role: "user" | "assistant";
    model?: string;
    content: string;
    thinking?: string;
    error?: string;
    toolCalls?: ReturnType<typeof toToolCallSummary>[];
  }[] = [];

  for (let index = 0; index < rawMessages.length; index++) {
    const raw = rawMessages[index];
    const message = timeline[index];

    if (!raw || !message || message.role === "tool") continue;

    if (message.role === "user") {
      messages.push({
        id: raw.messages_id,
        role: "user",
        content: bytesToBase64(raw.content) ?? "",
      });
      continue;
    }

    const toolCalls = toolCallsByParent.get(raw.messages_id) ?? [];

    messages.push({
      id: raw.messages_id,
      role: "assistant",
      model: message.model || undefined,
      content: bytesToBase64(raw.content) ?? "",
      thinking: bytesToBase64(raw.thinking) ?? undefined,
      error: bytesToBase64(raw.error_message) ?? undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });
  }

  return c.json({
    messages,
    usage: {
      total: usage.total_tokens,
      input: usage.input_tokens,
      output: usage.output_tokens,
      cache: usage.cache_read_tokens,
      cacheRatio: usage.cache_ratio,
      contextRatio: usage.context_ratio,
    },
  });
}

/**
 * DELETE /api/conversations/:id
 * @param c - Hono 请求上下文
 * @returns 删除成功确认，或参数错误 / 资源不存在响应
 */
export async function deleteConversationHandler(c: Context) {
  const id = c.req.param("id");

  if (!id || !isUuid(id)) {
    return c.json({ error: "id is invalid" }, 400);
  }

  const deleted = await deleteConversation(id);

  if (!deleted) {
    return c.json({ error: "conversation not found" }, 404);
  }

  return c.json({ ok: true });
}
