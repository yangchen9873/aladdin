/**
 * @fileoverview 工具调用审计表：完整出入参，按需通过详情接口拉取。
 */

import { compressText, decompressText } from "../shared/codec.js";
import { pool } from "../shared/database.js";

/** 工具调用状态 */
export type ToolCallStatus = "running" | "done" | "error" | "aborted";

/** 详情（含完整出入参） */
export type ToolCallDetail = {
  tool_calls_id: string;
  conversations_id: string;
  messages_id: string;
  tool_name: string;
  arguments: unknown;
  result_content: string;
  result_details: unknown;
  status: ToolCallStatus;
  error_message: string;
  duration_ms: number | null;
  started_at: Date;
  finished_at: Date | null;
};

/**
 * 解析 gzip JSON。非法内容当作 null。
 */
function parseGzipJson(value: Buffer | Uint8Array | null | undefined): unknown {
  const text = decompressText(value);

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * 工具开始：写审计表 + 插入 tool 时间线行。
 * @param row - 工具调用关联的会话、消息与入参
 * @returns 写入完成后结束
 */
export async function startToolCall(row: {
  toolCallId: string;
  conversationId: string;
  turnId: string;
  assistantMessageId: string;
  toolMessageId: string;
  toolName: string;
  args: unknown;
  startedAt: Date;
}): Promise<void> {
  const argumentsBytes = row.args == null ? null : compressText(JSON.stringify(row.args));

  await pool.query(
    `WITH audit AS (
       INSERT INTO tool_calls (
       id, conversation_id, turn_id, assistant_message_id,
       tool_name, arguments, result_content, result_details, error_message,
       status, started_at
       ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid,
       $5::varchar, $6::bytea, $9::bytea, $9::bytea, $9::bytea,
       'running', $10::timestamptz
       )
     )
     INSERT INTO messages (
       id, conversation_id, turn_id, role, model, content,
       thinking, tool_calls_content, error_message,
       tool_calls_id, parent_message_id, tool_name, tool_status
     ) VALUES (
       $7::uuid, $2::uuid, $3::uuid, 'tool', NULL, $8::bytea,
       $9::bytea, $9::bytea, $9::bytea,
       $1::uuid, $4::uuid, $5::varchar, 'running'
     )`,
    [
      row.toolCallId,
      row.conversationId,
      row.turnId,
      row.assistantMessageId,
      row.toolName,
      argumentsBytes,
      row.toolMessageId,
      null,
      null,
      row.startedAt,
    ],
  );
}

/**
 * 工具结束：回写审计表与 tool 时间线行。
 * @param toolCallId - 工具调用 ID
 * @param patch - 最终状态、结果内容与关联 tool 消息 ID
 * @returns 更新完成后结束
 * @throws {Error} 审计行或时间线行未处于 running 状态时抛出异常
 */
export async function finishToolCall(
  toolCallId: string,
  patch: {
    status: Exclude<ToolCallStatus, "running">;
    resultContent: string | null;
    resultDetails: unknown;
    errorMessage: string | null;
    toolMessageId: string;
  },
): Promise<void> {
  const result = await pool.query<{
    audit_updated: number;
    message_updated: number;
  }>(
    `WITH audit AS (
       UPDATE tool_calls
       SET status = $2::varchar,
           result_content = $3::bytea,
           result_details = $4::bytea,
           error_message = $5::bytea,
           finished_at = now(),
           duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::integer,
           update_time = now()
       WHERE id = $1::uuid AND invalid_flag = '0' AND status = 'running'
       RETURNING id, duration_ms
     ),
     message AS (
       UPDATE messages AS m
       SET error_message = $5::bytea,
           tool_status = $2::varchar,
           tool_duration_ms = audit.duration_ms,
           update_time = now()
       FROM audit
       WHERE m.id = $6::uuid AND m.invalid_flag = '0'
       RETURNING m.id
     )
     SELECT
       (SELECT COUNT(*)::integer FROM audit) AS audit_updated,
       (SELECT COUNT(*)::integer FROM message) AS message_updated`,
    [
      toolCallId,
      patch.status,
      compressText(patch.resultContent),
      compressText(patch.resultDetails == null ? null : JSON.stringify(patch.resultDetails)),
      compressText(patch.errorMessage),
      patch.toolMessageId,
    ],
  );

  const updated = result.rows[0];
  if (updated?.audit_updated !== 1 || updated.message_updated !== 1) {
    throw new Error(
      `Unable to finish tool call ${toolCallId} and tool message ${patch.toolMessageId}`,
    );
  }
}

/**
 * 将仍在 running 的工具标为 aborted。
 * @param tools - 待中止的工具调用 ID 与 tool 消息 ID 对
 * @returns 更新完成后结束
 */
export async function abortRunningToolCalls(
  tools: { toolCallId: string; toolMessageId: string }[],
): Promise<void> {
  if (tools.length === 0) {
    return;
  }

  const toolIds = tools.map((row) => row.toolCallId);
  const messageIds = tools.map((row) => row.toolMessageId);
  const nullContents = tools.map(() => null);
  const errors = tools.map(() => compressText("aborted"));

  await pool.query(
    `WITH audit AS (
       UPDATE tool_calls
       SET status = 'aborted',
           error_message = $2::bytea,
           finished_at = now(),
           duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::integer,
           update_time = now()
       WHERE id = ANY($1::uuid[]) AND invalid_flag = '0' AND status = 'running'
       RETURNING id, started_at, duration_ms
     )
     UPDATE messages AS m
     SET content = v.content,
         error_message = v.error_message,
         tool_status = 'aborted',
         tool_duration_ms = audit.duration_ms,
         update_time = now()
     FROM unnest($3::uuid[], $4::bytea[], $5::bytea[]) AS v(id, content, error_message),
          audit
     WHERE m.id = v.id
       AND m.tool_calls_id = audit.id
       AND m.invalid_flag = '0'`,
    [toolIds, compressText("aborted"), messageIds, nullContents, errors],
  );
}

/**
 * 按 ID 拉取工具调用详情。
 * @param toolCallId - 工具调用 ID
 * @returns 含完整出入参的详情；不存在时返回 null
 */
export async function getToolCallDetail(toolCallId: string): Promise<ToolCallDetail | null> {
  const result = await pool.query<{
    tool_calls_id: string;
    conversations_id: string;
    messages_id: string;
    tool_name: string;
    arguments: Buffer;
    result_content: Buffer;
    result_details: Buffer;
    status: ToolCallStatus;
    error_message: Buffer;
    duration_ms: number | null;
    started_at: Date;
    finished_at: Date | null;
  }>(
    `SELECT
       id AS tool_calls_id, conversation_id AS conversations_id, assistant_message_id AS messages_id,
       tool_name, arguments,
       result_content, result_details, status, error_message, duration_ms,
       started_at, finished_at
     FROM tool_calls
     WHERE id = $1::uuid AND invalid_flag = '0'`,
    [toolCallId],
  );

  const row = result.rows[0];

  if (!row) return null;

  return {
    tool_calls_id: row.tool_calls_id,
    conversations_id: row.conversations_id,
    messages_id: row.messages_id,
    tool_name: row.tool_name,
    arguments: parseGzipJson(row.arguments),
    result_content: decompressText(row.result_content),
    result_details: parseGzipJson(row.result_details),
    status: row.status,
    error_message: decompressText(row.error_message),
    duration_ms: row.duration_ms,
    started_at: row.started_at,
    finished_at: row.finished_at,
  };
}
