/**
 * @fileoverview 与后端聊天 SSE 接口的客户端。
 */

import { createParser } from "eventsource-parser";
import type { TokenUsage } from "../types/chat";

/** 后端推送的 SSE 事件 */
export type ChatSseEvent =
  | {
      type: "session";
      conversationId: string;
      title: string;
      userMessageId: string;
      assistantMessageId: string;
      model: string;
    }
  | { type: "delta"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "assistant_start"; assistantMessageId: string; model: string }
  | {
      type: "tool_start";
      id: string;
      name: string;
      arguments: unknown;
    }
  | {
      type: "tool_end";
      id: string;
      name: string;
      result: string | null;
      details: unknown;
      isError: boolean;
      error?: string;
      durationMs: number | null;
    }
  | {
      type: "usage";
      total: number | null;
      input: number | null;
      output: number | null;
      cache: number | null;
      contextRatio: number | null;
    }
  | { type: "done" }
  | { type: "error"; message: string };

type StreamChatOptions = {
  /** 已有会话 ID；首轮不传，由服务端创建 */
  conversationId?: string;
  /** 已有会话标题；续聊时原样回传，避免服务端读取 conversations */
  title?: string;
  /** 本轮用户输入 */
  content: string;
  /** 本轮使用的文本模型配置 */
  modelConfigurationId?: string;
  /** 取消信号 */
  signal?: AbortSignal;
  /** 会话落库后的 ID 回调 */
  onSession: (session: {
    conversationId: string;
    title: string;
    userMessageId: string;
    assistantMessageId: string;
    model: string;
  }) => void;
  /** 正文增量回调 */
  onDelta: (delta: string) => void;
  /** 思考增量回调 */
  onThinking: (delta: string) => void;
  /** 后续 LLM 调用对应的新助手消息 */
  onAssistantStart: (assistantMessageId: string, model: string) => void;
  /** 工具开始 */
  onToolStart: (call: { id: string; name: string; arguments: unknown }) => void;
  /** 工具结束 */
  onToolEnd: (call: {
    id: string;
    name: string;
    result: string | null;
    details: unknown;
    isError: boolean;
    error?: string;
    durationMs: number | null;
  }) => void;
  /** 一次 LLM 调用结束后的 token 用量 */
  onUsage: (
    usage: Pick<TokenUsage, "total" | "input" | "output" | "cache" | "contextRatio">,
  ) => void;
};

/**
 * 分发单条 SSE 业务事件。
 * @param event - 已解析事件
 * @param options - 业务回调
 */
function applyEvent(
  event: ChatSseEvent,
  options: Pick<
    StreamChatOptions,
    | "onSession"
    | "onDelta"
    | "onThinking"
    | "onAssistantStart"
    | "onToolStart"
    | "onToolEnd"
    | "onUsage"
  >,
): void {
  if (event.type === "session") {
    options.onSession(event);
    return;
  }

  if (event.type === "delta") options.onDelta(event.delta);

  if (event.type === "thinking") options.onThinking(event.delta);

  if (event.type === "assistant_start") {
    options.onAssistantStart(event.assistantMessageId, event.model);
    return;
  }

  if (event.type === "tool_start") {
    options.onToolStart(event);
    return;
  }

  if (event.type === "tool_end") {
    options.onToolEnd(event);
    return;
  }

  if (event.type === "usage") {
    options.onUsage({
      total: event.total ?? (event.input ?? 0) + (event.output ?? 0) + (event.cache ?? 0),
      input: event.input ?? 0,
      output: event.output ?? 0,
      cache: event.cache ?? 0,
      contextRatio: event.contextRatio ?? 0,
    });
    return;
  }

  if (event.type === "error") throw new Error(event.message);
}

/**
 * 请求 `/api/chat` 并以 SSE 流式接收助手回复。
 * 只发送本轮用户输入，不发送历史消息。
 * @param options - 请求与回调
 * @returns 流式结束后 resolve；中途出错或收到 error 事件时 reject
 */
export async function streamChat({
  conversationId,
  title,
  content,
  modelConfigurationId,
  signal,
  onSession,
  onDelta,
  onThinking,
  onAssistantStart,
  onToolStart,
  onToolEnd,
  onUsage,
}: StreamChatOptions): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, title, content, modelConfigurationId }),
    signal,
  });

  // 先处理 HTTP 层错误，避免把错误 JSON 当作 SSE 流继续解析。
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (errorBody?.error) {
      throw new Error(errorBody.error);
    }

    throw new Error(`Chat request failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error("Chat stream is empty");
  }

  // 建立 SSE 解析器，将协议事件转换为业务回调。
  const parser = createParser({
    onEvent: (message) => {
      if (!message.data) return;
      let event: ChatSseEvent;

      try {
        event = JSON.parse(message.data) as ChatSseEvent;
      } catch (error) {
        throw new Error("聊天服务返回了无效的 SSE 数据", { cause: error });
      }

      applyEvent(event, {
        onSession,
        onDelta,
        onThinking,
        onAssistantStart,
        onToolStart,
        onToolEnd,
        onUsage,
      });
    },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // 持续读取网络分片，逐段交给 SSE 解析器处理。
  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    parser.feed(decoder.decode(value, { stream: true }));
  }

  // flush decoder 中可能残留的多字节字符，确保末尾事件内容完整。
  parser.feed(decoder.decode());

  parser.reset({ consume: true });
}
