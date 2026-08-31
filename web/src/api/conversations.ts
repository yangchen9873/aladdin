/**
 * @fileoverview 会话列表 / 详情 / 删除 API。
 */

import { decompressGzipBase64, decompressGzipBase64Optional } from "../lib/gzip";
import type { Message, TokenUsage, ToolCall } from "../types/chat";
import { requestJson, requestVoid } from "./http";

/** 侧边栏会话摘要 */
export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: number;
};

/** 会话摘要的游标分页响应。 */
export type ConversationPage = {
  conversations: ConversationSummary[];
  nextCursor: string | null;
};

/** 恢复页面所需的会话消息。 */
export type ConversationMessages = {
  messages: Message[];
  usage: TokenUsage;
};

/**
 * 拉取一页会话摘要（UUIDv7 主键倒序）。
 * @param cursor - 上一页最后一条会话 ID；为空时读取首页
 * @returns 会话摘要页
 */
export async function listConversations(cursor?: string): Promise<ConversationPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const body = await requestJson<ConversationPage>(`/api/conversations${query}`);

  return body;
}

type ConversationWire = {
  messages: {
    id: string;
    role: Message["role"];
    model?: string;
    content?: string;
    thinking?: string;
    error?: string;
    toolCalls?: {
      toolCallId: string;
      name: string;
      status: ToolCall["status"];
      error?: string;
      durationMs?: number;
    }[];
  }[];
  usage: TokenUsage;
};

/**
 * 拉取单个会话及其消息。
 * @param id - 会话 ID
 * @returns 会话详情（正文已在浏览器解压）
 */
export async function getConversation(id: string): Promise<ConversationMessages> {
  const body = await requestJson<ConversationWire>(`/api/conversations/${id}`);

  return {
    messages: body.messages.map((message) => ({
      id: message.id,
      role: message.role,
      model: message.model,
      content: message.content ? decompressGzipBase64(message.content) : "",
      thinking:
        message.role === "assistant"
          ? (decompressGzipBase64Optional(message.thinking) ?? "")
          : undefined,
      error: decompressGzipBase64Optional(message.error),
      toolCalls:
        message.role === "assistant"
          ? (message.toolCalls?.map((call) => ({ ...call, id: call.toolCallId })) ?? [])
          : undefined,
    })),
    usage: body.usage,
  };
}

/**
 * 删除会话。
 * @param id - 会话 ID
 */
export async function deleteConversation(id: string): Promise<void> {
  await requestVoid(`/api/conversations/${id}`, { method: "DELETE" });
}
