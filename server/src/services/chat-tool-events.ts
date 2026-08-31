/**
 * @fileoverview 聊天流中工具执行事件的状态转换。
 */

import type { StoredToolMessage } from "../llm/tool-message.js";

/** 聊天流中单个工具的执行持久化记录 */
export type ToolExecutionRecord = {
  toolCallId: string;
  toolMessageId: string;
  timeline: StoredToolMessage;
};

/** 工具结束后的时间线摘要；durationMs 已由 finishToolRecord 写入。 */
export type CompletedToolExecutionRecord = Omit<ToolExecutionRecord, "timeline"> & {
  timeline: Omit<StoredToolMessage, "durationMs" | "status"> & {
    durationMs: number | null;
    status: Exclude<StoredToolMessage["status"], "running">;
  };
};

/**
 * 创建工具开始事件对应的持久化记录和页面时间线摘要。
 * @param toolCallId - 数据库工具调用 ID
 * @param toolMessageId - 会话工具消息 ID
 * @param name - 工具名称
 * @returns 等待完成事件补写的记录
 */
export function createRunningToolRecord(
  toolCallId: string,
  toolMessageId: string,
  name: string,
): ToolExecutionRecord {
  return {
    toolCallId,
    toolMessageId,
    timeline: { toolCallId, name, status: "running" },
  };
}

/**
 * 根据工具结束事件生成最终时间线摘要。
 * @param record - 工具开始时创建的记录
 * @param isError - 工具是否执行失败
 * @param error - 可显示的失败信息
 * @param startedAt - 工具开始时间
 * @returns 更新后的工具记录
 */
export function finishToolRecord(
  record: ToolExecutionRecord,
  isError: boolean,
  error: string | null,
  startedAt: number | undefined,
): CompletedToolExecutionRecord {
  return {
    ...record,
    timeline: {
      ...record.timeline,
      status: isError ? "error" : "done",
      error,
      durationMs: startedAt === undefined ? null : Math.round(performance.now() - startedAt),
    },
  };
}
