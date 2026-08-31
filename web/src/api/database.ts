/**
 * @fileoverview 数据库查看器 API。
 */

import { requestJson } from "./http";

/** 可查看的数据表 */
export const DATABASE_TABLES = [
  { name: "system_prompts", label: "系统提示词" },
  { name: "model_configurations", label: "大模型配置" },
  { name: "conversations", label: "会话" },
  { name: "conversation_contexts", label: "上下文快照" },
  { name: "messages", label: "消息" },
  { name: "llm_calls", label: "LLM 调用" },
  { name: "tool_calls", label: "工具调用" },
] as const;

/** 可查看的数据表名 */
export type DatabaseTableName = (typeof DATABASE_TABLES)[number]["name"];

/** 一页数据库记录 */
export type DatabaseTableData = {
  table: DatabaseTableName;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * 查询一页表数据。压缩字段已经由服务端解压。
 * @param table - 允许查看的数据表
 * @param limit - 每页记录数
 * @param offset - 分页偏移量
 * @param conversationId - 可选的会话筛选条件
 * @param signal - 取消请求的信号
 * @returns 当前页数据及分页元信息
 */
export async function getDatabaseTable(
  table: DatabaseTableName,
  limit: number,
  offset: number,
  conversationId?: string | null,
  signal?: AbortSignal,
): Promise<DatabaseTableData> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  if (conversationId && table !== "conversations") {
    query.set("conversationId", conversationId);
  }

  return requestJson<DatabaseTableData>(`/api/database/${table}?${query}`, { signal });
}
