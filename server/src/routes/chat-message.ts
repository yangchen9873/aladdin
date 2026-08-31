/**
 * @fileoverview 聊天路由使用的 LLM 消息解析纯函数。
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";

/**
 * 从工具执行结果中提取回传模型的文本。
 * @param result - 工具执行结果
 * @returns 拼接后的文本；没有文本时返回 null
 */
export function toolResultText(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("content" in result)) return null;
  const content = (result as { content?: { type: string; text?: string }[] }).content;
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n");
  return text || null;
}

/**
 * 从工具执行结果中提取结构化详情。
 * @param result - 工具执行结果
 * @returns 结构化详情；没有详情时返回 null
 */
export function toolResultDetails(result: unknown): unknown {
  if (!result || typeof result !== "object" || !("details" in result)) return null;
  return (result as { details?: unknown }).details ?? null;
}

/**
 * 分离助手消息正文与思考内容。
 * @param message - LLM 返回的助手消息
 * @returns 正文与思考文本
 */
export function assistantParts(message: AssistantMessage): {
  content: string;
  thinking: string;
} {
  return message.content.reduce(
    (parts, item) => {
      if (item.type === "text") parts.content += item.text;
      if (item.type === "thinking") parts.thinking += item.thinking;
      return parts;
    },
    { content: "", thinking: "" },
  );
}

/**
 * 提取助手消息中的原始工具调用 JSON。
 * @param message - LLM 返回的助手消息
 * @returns 工具调用 JSON；没有工具调用时返回 null
 */
export function assistantToolCalls(message: AssistantMessage): string | null {
  const calls = message.content.filter((item) => item.type === "toolCall");
  return calls.length > 0 ? JSON.stringify(calls) : null;
}

/**
 * 提取助手消息中的工具调用 ID。
 * @param message - LLM 返回的助手消息
 * @returns 工具调用 ID 列表
 */
export function assistantToolCallIds(message: AssistantMessage): string[] {
  return message.content.flatMap((item) => (item.type === "toolCall" ? [item.id] : []));
}

/**
 * 将压缩后的上下文与压缩点之后新增的消息重新拼接。
 * @param transformedContext - 最近一次上下文压缩结果
 * @param messages - Agent 当前完整消息列表
 * @returns 用于最终持久化的消息上下文
 */
export function mergeTransformedContext(
  transformedContext: AgentMessage[] | null,
  messages: AgentMessage[],
): AgentMessage[] {
  if (!transformedContext) return messages;

  const last = transformedContext[transformedContext.length - 1];
  const index = last ? messages.lastIndexOf(last) : -1;

  return index >= 0 ? [...transformedContext, ...messages.slice(index + 1)] : messages;
}
