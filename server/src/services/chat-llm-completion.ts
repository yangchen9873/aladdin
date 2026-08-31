/**
 * @fileoverview 助手消息结束时的审计与 SSE 用量数据映射。
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { FinishLlmCallInput } from "../db/llm-calls.js";
import { assistantParts, assistantToolCalls } from "../routes/chat-message.js";
import type { LlmTimingMetrics } from "./llm-call-timing.js";

/** SSE 用量事件载荷 */
export type UsageEvent = {
  total: number | null;
  input: number | null;
  output: number | null;
  cache: number | null;
  contextRatio: number | null;
};

/** 单次助手响应完成后的审计与页面更新数据 */
export type LlmCompletion = {
  finish: Omit<FinishLlmCallInput, "llmCallId">;
  toolCallsContent: string | null;
  content: string;
  thinking: string | null;
  usageEvent: UsageEvent;
};

/**
 * 将一次助手响应转换为数据库审计字段和前端用量事件。
 * @param assistant - 已结束的助手消息
 * @param contextWindow - 当前模型上下文窗口大小
 * @param timing - 本次调用的时间指标
 * @returns 完成 LLM 调用和更新页面所需的数据
 */
export function buildLlmCompletion(
  assistant: AssistantMessage,
  contextWindow: number,
  timing: LlmTimingMetrics,
): LlmCompletion {
  const parts = assistantParts(assistant);
  const toolCallsContent = assistantToolCalls(assistant);
  const usage = assistant.usage;
  const cacheBase = usage.input + usage.cacheRead;

  return {
    finish: {
      status:
        assistant.stopReason === "error"
          ? "error"
          : assistant.stopReason === "aborted"
            ? "aborted"
            : "done",
      errorMessage: assistant.errorMessage ?? null,
      stopReason: assistant.stopReason,
      thinking: parts.thinking || null,
      outputContent: parts.content || null,
      toolCallsContent,
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheReadTokens: usage.cacheRead,
      cacheWriteTokens: usage.cacheWrite,
      totalTokens: usage.totalTokens,
      costInput: usage.cost.input,
      costOutput: usage.cost.output,
      costCacheRead: usage.cost.cacheRead,
      costCacheWrite: usage.cost.cacheWrite,
      costTotal: usage.cost.total,
      cacheRatio: cacheBase > 0 ? usage.cacheRead / cacheBase : null,
      ttftMs: timing.ttftMs,
      tps: timing.tps,
    },
    toolCallsContent,
    content: parts.content,
    thinking: parts.thinking || null,
    usageEvent: {
      total: usage.totalTokens,
      input: usage.input,
      output: usage.output,
      cache: usage.cacheRead,
      contextRatio: contextWindow > 0 ? (usage.input + usage.cacheRead) / contextWindow : null,
    },
  };
}
