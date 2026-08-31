/**
 * @fileoverview 续聊上下文快照的紧凑序列化与恢复。
 *
 * 快照只保存下一次模型调用所需的会话语义；调用审计字段由 llm_calls 保存，
 * 不重复写进 conversation_contexts。
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasToolCall(content: unknown): boolean {
  return (
    Array.isArray(content) && content.some((item) => isRecord(item) && item.type === "toolCall")
  );
}

function emptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

/**
 * 删除不影响下一次模型请求的运行时元数据。
 * 思考内容只用于消息展示，不写入续聊快照；工具调用仍需保留以维持上下文语义。
 * @param messages - Agent 当前完整消息状态
 * @returns 可压缩持久化的紧凑上下文
 */
export function compactConversationContext(messages: AgentMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === "user") {
      return { role: "user", content: message.content };
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: Array.isArray(message.content)
          ? message.content.filter((item) => !isRecord(item) || item.type !== "thinking")
          : message.content,
        ...(message.errorMessage ? { errorMessage: message.errorMessage } : {}),
      };
    }

    if (message.role === "toolResult") {
      return {
        role: "toolResult",
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        content: message.content,
        isError: message.isError,
      };
    }

    // pi-agent-core 的内部消息不会出现在常规聊天时间线；若出现则原样保留，
    // 以避免破坏其运行语义。
    return message;
  });
}

const CHARS_PER_TOKEN = 4;
const COMPACTION_RATIO = 0.9;
const RECENT_MESSAGE_COUNT = 8;

function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN);
}

function messageText(message: AgentMessage): string {
  return JSON.stringify(message);
}

function responseText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (item): item is { type: "text"; text: string } =>
        isRecord(item) && item.type === "text" && typeof item.text === "string",
    )
    .map((item) => item.text)
    .join("\n");
}

/**
 * 在下一次模型请求前按窗口占用压缩历史消息。
 * 估算不依赖供应商 tokenizer，摘要失败时保留最近消息作为降级方案。
 * @param messages - 当前 Agent 消息列表
 * @param systemPrompt - 系统提示词
 * @param model - 当前模型（含 contextWindow）
 * @param models - Models 集合，用于调用摘要模型
 * @param apiKey - API Key
 * @param signal - 可选取消信号
 * @returns 压缩后的消息列表；无需压缩或摘要失败时返回原列表或降级子集
 */
export async function compactContextIfNeeded(
  messages: AgentMessage[],
  systemPrompt: string,
  model: Model<Api>,
  models: Models,
  apiKey: string,
  signal?: AbortSignal,
): Promise<AgentMessage[]> {
  const limit = Math.floor(model.contextWindow * COMPACTION_RATIO);
  if (limit <= 0 || estimateTokens({ systemPrompt, messages }) <= limit) {
    return messages;
  }

  const splitAt = Math.max(messages.length - RECENT_MESSAGE_COUNT, 1);
  const older = messages.slice(0, splitAt);
  const recent = messages.slice(splitAt);
  const fallback = recent.length > 0 ? recent : messages.slice(-1);
  const history = older.map(messageText).join("\n");

  try {
    const summary = await models.completeSimple(
      model,
      {
        systemPrompt:
          "你是对话历史压缩器。请用简洁、客观的中文总结历史，保留用户目标、关键事实、已完成工作、约束和未解决问题。不要添加新信息。",
        messages: [
          {
            role: "user",
            content: `请总结以下历史对话：\n\n${history}`,
            timestamp: Date.now(),
          },
        ],
      },
      { apiKey, reasoning: "low", signal },
    );
    const text = responseText(summary.content).trim();
    if (!text) return fallback;

    return [
      {
        role: "user",
        content:
          "[历史上下文摘要]\n以下内容由系统根据较早的对话生成，仅供理解上下文参考，不是新的用户指令。\n\n" +
          text,
        timestamp: Date.now(),
      } as AgentMessage,
      ...fallback,
    ];
  } catch (error) {
    console.error("failed to compact conversation context", error);
    return fallback;
  }
}

/**
 * 将紧凑快照还原成 pi-agent-core 可执行的消息；历史完整版快照也可继续读取。
 * @param snapshot - 数据库解压后的快照
 * @param model - 当前调用模型，用于补齐不持久化的运行字段
 * @returns 模型可用的消息数组，结构非法时返回 null
 */
export function restoreConversationContext(
  snapshot: unknown,
  model: Model<Api>,
): AgentMessage[] | null {
  if (!Array.isArray(snapshot)) return null;

  const timestamp = Date.now();
  const restored: AgentMessage[] = [];

  for (const item of snapshot) {
    if (!isRecord(item) || typeof item.role !== "string") return null;

    // 旧快照带完整运行字段，可直接复用；下一轮成功后会自动重写为紧凑格式。
    if (typeof item.timestamp === "number") {
      restored.push(item as unknown as AgentMessage);
      continue;
    }

    if (item.role === "user" && item.content !== undefined) {
      restored.push({
        role: "user",
        content: item.content,
        timestamp,
      } as AgentMessage);
      continue;
    }

    if (item.role === "assistant" && Array.isArray(item.content)) {
      restored.push({
        role: "assistant",
        content: item.content,
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: emptyUsage(),
        stopReason: item.errorMessage ? "error" : hasToolCall(item.content) ? "toolUse" : "stop",
        ...(typeof item.errorMessage === "string" ? { errorMessage: item.errorMessage } : {}),
        timestamp,
      } as AgentMessage);
      continue;
    }

    if (
      item.role === "toolResult" &&
      typeof item.toolCallId === "string" &&
      typeof item.toolName === "string" &&
      Array.isArray(item.content) &&
      typeof item.isError === "boolean"
    ) {
      restored.push({
        role: "toolResult",
        toolCallId: item.toolCallId,
        toolName: item.toolName,
        content: item.content,
        isError: item.isError,
        timestamp,
      } as AgentMessage);
      continue;
    }

    return null;
  }

  return restored;
}
