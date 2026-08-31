/**
 * @fileoverview 聊天流结束后的补偿性持久化逻辑。
 */

import { finishLlmCall } from "../db/llm-calls.js";
import { abortRunningToolCalls } from "../db/tool-calls.js";

/** 聊天流最终完成状态 */
export type ChatCompletionStatus = "done" | "error" | "aborted";

/** 待补偿中止的工具调用标识 */
export type PendingTool = {
  toolCallId: string;
  toolMessageId: string;
};

/**
 * 将尚未完成的工具调用统一标记为中止。
 * @param tools - 工具调用记录
 * @param finishedToolIds - 已完成的 Agent 工具调用 ID
 * @returns 写入完成后结束
 */
export async function abortPendingTools(
  tools: ReadonlyMap<string, PendingTool>,
  finishedToolIds: ReadonlySet<string>,
): Promise<void> {
  const pending = [...tools.entries()]
    .filter(([id]) => !finishedToolIds.has(id))
    .map(([, tool]) => tool);

  await abortRunningToolCalls(pending);
}

/**
 * 补齐尚未收到 message_end 的 LLM 调用记录。
 * @param llmCallIds - 本轮启动过的全部 LLM 调用 ID
 * @param finishedLlmCallIds - 已由正常响应完成的 LLM 调用 ID
 * @param status - 本轮最终状态
 * @param errorMessage - 本轮错误信息
 * @returns 所有补偿写入完成后结束
 */
export async function finishPendingLlmCalls(
  llmCallIds: ReadonlySet<string>,
  finishedLlmCallIds: ReadonlySet<string>,
  status: ChatCompletionStatus,
  errorMessage: string | null,
): Promise<void> {
  for (const llmCallId of llmCallIds) {
    if (finishedLlmCallIds.has(llmCallId)) continue;

    await finishLlmCall({
      llmCallId,
      status,
      errorMessage,
      stopReason: status,
      thinking: null,
      outputContent: null,
      toolCallsContent: null,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: null,
      costInput: null,
      costOutput: null,
      costCacheRead: null,
      costCacheWrite: null,
      costTotal: null,
      cacheRatio: null,
      ttftMs: null,
      tps: null,
    });
  }
}
