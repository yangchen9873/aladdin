/**
 * @fileoverview 一轮对话的成批写入。
 *
 * 用 PostgreSQL 可写 CTE 把多表 INSERT/UPDATE 合成一条 SQL：
 * 一次 round-trip，同一事务。调用前落库、结束后回写，中间流式不写库。
 */

import { compressText, decompressText } from "../shared/codec.js";
import { pool } from "../shared/database.js";
import { v7 as uuidv7 } from "uuid";

/** 调用状态 */
export type LlmCallStatus = "running" | "done" | "error" | "aborted";

/** 开场写入参数 */
export type StartTurnInput = {
  isNewConversation: boolean;
  conversationId: string;
  turnId: string;
  title: string;
  userMessageId: string;
  assistantMessageId: string;
  userContent: string;
  model: string;
};

/** 收尾回写参数 */
export type FinishTurnInput = {
  messageId: string;
  content: string;
  thinking: string | null;
  toolCallsContent: string | null;
  errorMessage: string | null;
};

/** 用户消息 + 空助手行（已有会话）。 */
const SQL_START_EXISTING = `
  INSERT INTO messages (
    id, conversation_id, turn_id, role, model, content, thinking,
    tool_calls_content, error_message, tool_calls_id, parent_message_id
  )
  VALUES
    ($2::uuid, $1::uuid, $6::uuid, 'user', NULL, $3::bytea, $8::bytea, $8::bytea, $8::bytea, NULL, NULL),
    ($4::uuid, $1::uuid, $6::uuid, 'assistant', $7::varchar, $5::bytea, $8::bytea, $8::bytea, $8::bytea, NULL, NULL)
`;

/** 同上，并同时插入会话。 */
const SQL_START_NEW = `
  WITH conv AS (
    INSERT INTO conversations (id, title) VALUES ($1::uuid, $2::varchar)
  )
  INSERT INTO messages (
    id, conversation_id, turn_id, role, model, content, thinking,
    tool_calls_content, error_message, tool_calls_id, parent_message_id
  )
  VALUES
    ($3::uuid, $1::uuid, $7::uuid, 'user', NULL, $4::bytea, $9::bytea, $9::bytea, $9::bytea, NULL, NULL),
    ($5::uuid, $1::uuid, $7::uuid, 'assistant', $8::varchar, $6::bytea, $9::bytea, $9::bytea, $9::bytea, NULL, NULL)
`;

/** 一次真实 LLM 请求的审计记录。 */
export type StartLlmCallInput = {
  llmCallId: string;
  conversationId: string;
  turnId: string;
  messageId: string;
  provider: string;
  model: string;
  thinkingLevel: string;
  inputContent: string;
  startedAt: Date;
};

/** 一次真实 LLM 请求的收尾数据。 */
export type FinishLlmCallInput = {
  llmCallId: string;
  status: Exclude<LlmCallStatus, "running">;
  errorMessage: string | null;
  stopReason: string | null;
  thinking: string | null;
  outputContent: string | null;
  textContent: string | null;
  toolCallsContent: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  totalTokens: number | null;
  costInput: number | null;
  costOutput: number | null;
  costCacheRead: number | null;
  costCacheWrite: number | null;
  costTotal: number | null;
  cacheRatio: number | null;
  ttftMs: number | null;
  tps: number | null;
};

/**
 * 插入一次真实 LLM 请求的运行中审计记录。
 * @param row - 请求关联的会话、模型和输入数据
 * @returns 写入完成后结束
 */
export async function startLlmCall(row: StartLlmCallInput): Promise<void> {
  await pool.query(
    `INSERT INTO llm_calls (
       id, conversation_id, turn_id, assistant_message_id,
       provider, model, thinking_level, input_content, output_content,
       thinking, text_content, tool_calls_content, error_message,
       status, started_at
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::varchar, $6::varchar, $7::varchar, $8::bytea, $9::bytea,
       $9::bytea, $9::bytea, $9::bytea, $9::bytea,
       'running', $10::timestamptz
     )`,
    [
      row.llmCallId,
      row.conversationId,
      row.turnId,
      row.messageId,
      row.provider,
      row.model,
      row.thinkingLevel,
      compressText(row.inputContent),
      null,
      row.startedAt,
    ],
  );
}

/**
 * 更新一次 LLM 请求的最终状态和用量指标。
 * @param patch - 完成状态、输出内容和性能指标
 * @returns 更新完成后结束
 */
export async function finishLlmCall(patch: FinishLlmCallInput): Promise<void> {
  await pool.query(
    `UPDATE llm_calls
     SET status = $2,
         error_message = $3,
         stop_reason = $4,
         output_content = $5,
         thinking = $6,
         text_content = $7,
         tool_calls_content = $8,
         input_tokens = $9,
         output_tokens = $10,
         cache_read_tokens = $11,
         cache_write_tokens = $12,
         total_tokens = $13,
         cost_input = $14,
         cost_output = $15,
         cost_cache_read = $16,
         cost_cache_write = $17,
         cost_total = $18,
         cache_ratio = $19,
         finished_at = now(),
         duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::integer,
         ttft_ms = $20,
         tps = $21,
         update_time = now()
     WHERE id = $1::uuid AND invalid_flag = '0'`,
    [
      patch.llmCallId,
      patch.status,
      compressText(patch.errorMessage),
      patch.stopReason,
      compressText(patch.outputContent),
      compressText(patch.thinking),
      compressText(patch.textContent),
      compressText(patch.toolCallsContent),
      patch.inputTokens,
      patch.outputTokens,
      patch.cacheReadTokens,
      patch.cacheWriteTokens,
      patch.totalTokens,
      patch.costInput,
      patch.costOutput,
      patch.costCacheRead,
      patch.costCacheWrite,
      patch.costTotal,
      patch.cacheRatio,
      patch.ttftMs,
      patch.tps,
    ],
  );
}

/**
 * 流式开始前写入用户消息和空助手行；新会话时同时插入会话。
 * @param row - 本轮开场数据
 * @returns 写入完成后结束
 */
export async function startTurn(row: StartTurnInput): Promise<void> {
  const userContent = compressText(row.userContent);
  const nullBytes = null;

  if (row.isNewConversation) {
    await pool.query(SQL_START_NEW, [
      row.conversationId,
      row.title,
      row.userMessageId,
      userContent,
      row.assistantMessageId,
      nullBytes,
      row.turnId,
      row.model,
      nullBytes,
    ]);
    return;
  }

  await pool.query(SQL_START_EXISTING, [
    row.conversationId,
    row.userMessageId,
    userContent,
    row.assistantMessageId,
    nullBytes,
    row.turnId,
    row.model,
    nullBytes,
  ]);
}

/**
 * 插入工具调用后新增的助手时间线节点。
 * @param conversationId - 会话 ID
 * @param turnId - 当前轮次 ID
 * @param messageId - 助手消息 ID
 * @param model - 使用的模型标识
 * @returns 写入完成后结束
 */
export async function startAssistantMessage(
  conversationId: string,
  turnId: string,
  messageId: string,
  model: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO messages (
       id, conversation_id, turn_id, role, model, content, thinking,
       tool_calls_content, error_message, tool_calls_id, parent_message_id
     )
     VALUES (
       $1::uuid, $2::uuid, $3::uuid, 'assistant', $4::varchar, $5::bytea, $5::bytea,
       $5::bytea, $5::bytea, NULL, NULL
     )`,
    [messageId, conversationId, turnId, model, null],
  );
}

/**
 * 流式结束后回写助手消息。
 * @param patch - 助手正文、思考、原始工具调用与错误
 * @returns 更新完成后结束
 */
export async function finishTurn(patch: FinishTurnInput): Promise<void> {
  await pool.query(
    `UPDATE messages
     SET content = $2, thinking = $3, tool_calls_content = $4, error_message = $5, update_time = now()
     WHERE id = $1 AND invalid_flag = '0'`,
    [
      patch.messageId,
      compressText(patch.content),
      compressText(patch.thinking),
      compressText(patch.toolCallsContent),
      compressText(patch.errorMessage),
    ],
  );
}

/**
 * 原子地回写最终助手消息并追加可续聊的上下文快照。
 * @param input - 助手输出与本轮完成后的模型上下文
 * @returns 写入完成后结束
 */
export async function finishTurnWithContext(
  input: FinishTurnInput & {
    conversationId: string;
    turnId: string;
    context: unknown;
  },
): Promise<void> {
  await pool.query(
    `WITH message AS (
       UPDATE messages
       SET content = $2::bytea,
           thinking = $3::bytea,
           tool_calls_content = $4::bytea,
           error_message = $5::bytea,
           update_time = now()
       WHERE id = $1::uuid AND invalid_flag = '0'
       RETURNING id
     )
     INSERT INTO conversation_contexts (
       id, conversation_id, turn_id, context_content, covered_message_id
     )
     SELECT $6::uuid, $7::uuid, $8::uuid, $9::bytea, id
     FROM message`,
    [
      input.messageId,
      compressText(input.content),
      compressText(input.thinking),
      compressText(input.toolCallsContent),
      compressText(input.errorMessage),
      uuidv7(),
      input.conversationId,
      input.turnId,
      compressText(JSON.stringify(input.context)),
    ],
  );
}

/**
 * 读取会话最新的续聊上下文快照。
 * @param conversationId - 会话 ID
 * @returns 解压后的模型消息数组；没有快照时返回 null
 */
export async function getLatestConversationContext(
  conversationId: string,
): Promise<unknown | null> {
  const result = await pool.query<{ context_content: Buffer }>(
    `SELECT context_content
       FROM conversation_contexts
      WHERE conversation_id = $1::uuid
        AND invalid_flag = '0'
       ORDER BY id DESC
      LIMIT 1`,
    [conversationId],
  );

  const encoded = result.rows[0]?.context_content;
  if (!encoded || encoded.length === 0) return null;

  const text = decompressText(encoded);
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
