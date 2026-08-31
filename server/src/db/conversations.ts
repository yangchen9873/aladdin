/**
 * @fileoverview 会话表读写。
 */

import type { CompressedMessageRow } from "./messages.js";
import { pool } from "../shared/database.js";

/** 会话摘要 */
export type ConversationRow = {
  conversations_id: string;
  title: string;
  created_at: Date;
};

/** 会话摘要的游标分页结果。 */
export type ConversationPage = {
  rows: ConversationRow[];
  nextCursor: string | null;
};

/** 会话中所有 LLM 调用的 token 汇总 */
export type ConversationUsageRow = {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_ratio: number;
  context_ratio: number;
};

/**
 * 判断会话是否存在且未被逻辑删除。
 * @param conversationId - 会话 ID
 * @returns 会话存在时返回 true
 */
export async function conversationExists(conversationId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
       FROM conversations
      WHERE id = $1::uuid AND invalid_flag = '0'`,
    [conversationId],
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * 读取页面恢复所需的会话消息，不查询会话元数据或模型上下文快照。
 * @param conversationId - 会话 ID
 * @returns 按 UUIDv7 时间顺序排列的有效消息
 */
export async function listConversationMessages(
  conversationId: string,
): Promise<CompressedMessageRow[]> {
  const result = await pool.query<CompressedMessageRow>(
    `SELECT
       id AS messages_id,
       conversation_id AS conversations_id,
       role, content, thinking, tool_calls_content, error_message,
       model,
       turn_id, tool_calls_id, parent_message_id, tool_name, tool_status, tool_duration_ms,
       create_time AS created_at
     FROM messages
     WHERE conversation_id = $1::uuid AND invalid_flag = '0'
     ORDER BY id ASC`,
    [conversationId],
  );

  return result.rows;
}

/**
 * 汇总会话中已完成或已结束的 LLM 调用用量。
 * @param conversationId - 会话 ID
 * @param contextWindow - 当前模型上下文窗口大小，用于计算 context_ratio
 * @returns 输入、输出、缓存读取量和加权缓存占比
 */
export async function getConversationUsage(
  conversationId: string,
  contextWindow: number,
): Promise<ConversationUsageRow> {
  const result = await pool.query<ConversationUsageRow>(
    `WITH calls AS (
       SELECT *
       FROM llm_calls
       WHERE conversation_id = $1::uuid AND invalid_flag = '0'
     ),
     latest AS (
       SELECT input_tokens, cache_read_tokens
       FROM calls
       ORDER BY id DESC
       LIMIT 1
     )
     SELECT
       COALESCE((SELECT SUM(total_tokens) FROM calls), 0)::integer AS total_tokens,
       COALESCE((SELECT SUM(input_tokens) FROM calls), 0)::integer AS input_tokens,
       COALESCE((SELECT SUM(output_tokens) FROM calls), 0)::integer AS output_tokens,
       COALESCE((SELECT SUM(cache_read_tokens) FROM calls), 0)::integer AS cache_read_tokens,
       CASE
         WHEN COALESCE((SELECT SUM(input_tokens) FROM calls), 0) +
             COALESCE((SELECT SUM(cache_read_tokens) FROM calls), 0) > 0
           THEN COALESCE((SELECT SUM(cache_read_tokens) FROM calls), 0)::double precision /
             (COALESCE((SELECT SUM(input_tokens) FROM calls), 0) +
               COALESCE((SELECT SUM(cache_read_tokens) FROM calls), 0))
         ELSE 0
       END AS cache_ratio,
       CASE
         WHEN $2::double precision > 0
           THEN (
             COALESCE((SELECT input_tokens FROM latest), 0) +
             COALESCE((SELECT cache_read_tokens FROM latest), 0)
           )::double precision / $2::double precision
         ELSE 0
       END AS context_ratio`,
    [conversationId, contextWindow],
  );

  return (
    result.rows[0] ?? {
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_ratio: 0,
      context_ratio: 0,
    }
  );
}

/**
 * 按 UUIDv7 主键倒序读取未删除会话。
 * @param cursor - 上一页最后一条会话 ID；为空时读取首页
 * @param limit - 每页最大返回条数
 * @returns 会话摘要页与下一页游标
 */
export async function listConversations(
  cursor: string | null,
  limit: number,
): Promise<ConversationPage> {
  const result = await pool.query<ConversationRow>(
    `SELECT id AS conversations_id, title, create_time AS created_at
     FROM conversations
     WHERE invalid_flag = '0'
       AND ($1::uuid IS NULL OR id < $1::uuid)
     ORDER BY id DESC
     LIMIT $2`,
    [cursor, limit + 1],
  );

  const hasNextPage = result.rows.length > limit;
  const rows = hasNextPage ? result.rows.slice(0, limit) : result.rows;

  return {
    rows,
    nextCursor: hasNextPage ? rows[rows.length - 1]!.conversations_id : null,
  };
}

/**
 * 一条 SQL 逻辑删除会话、消息、调用记录与上下文快照。
 * @param conversationId - 会话 ID
 * @returns 是否更新到未删除的会话行
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const result = await pool.query(
    `WITH contexts AS (
       UPDATE conversation_contexts
       SET invalid_flag = '1', update_time = now()
       WHERE conversation_id = $1 AND invalid_flag = '0'
     ),
     tools AS (
       UPDATE tool_calls
       SET invalid_flag = '1', update_time = now()
       WHERE conversation_id = $1 AND invalid_flag = '0'
     ),
     calls AS (
       UPDATE llm_calls
       SET invalid_flag = '1', update_time = now()
       WHERE conversation_id = $1 AND invalid_flag = '0'
     ),
     msgs AS (
       UPDATE messages
       SET invalid_flag = '1', update_time = now()
       WHERE conversation_id = $1 AND invalid_flag = '0'
     )
     UPDATE conversations
     SET invalid_flag = '1', update_time = now()
     WHERE id = $1 AND invalid_flag = '0'`,
    [conversationId],
  );

  return (result.rowCount ?? 0) > 0;
}
