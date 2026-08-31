/**
 * @fileoverview 数据库查看器：查询业务表并解码压缩字段。
 */

import { decompressText } from "../shared/codec.js";
import { pool } from "../shared/database.js";

/** 可供查看的表 */
export const INSPECTOR_TABLES = [
  "system_prompts",
  "model_configurations",
  "conversations",
  "conversation_contexts",
  "messages",
  "llm_calls",
  "tool_calls",
] as const;

/** 数据库查看器允许的表名 */
export type InspectorTable = (typeof INSPECTOR_TABLES)[number];

type CompressedFieldKind = "text" | "json";

type InspectorTableDefinition = {
  columns: string[];
  compressedFields: Record<string, CompressedFieldKind>;
  listSql: string;
  countSql: string;
  supportsConversationFilter?: boolean;
};

const TABLE_DEFINITIONS: Record<InspectorTable, InspectorTableDefinition> = {
  system_prompts: {
    columns: ["id", "content", "create_time", "update_time", "invalid_flag"],
    compressedFields: {},
    listSql: "SELECT * FROM system_prompts ORDER BY id DESC LIMIT $1 OFFSET $2",
    countSql: "SELECT COUNT(*)::integer AS count FROM system_prompts",
  },
  model_configurations: {
    columns: [
      "id",
      "kind",
      "label",
      "provider",
      "model",
      "api_key",
      "base_url",
      "model_alias",
      "thinking_level",
      "is_active",
      "create_time",
      "update_time",
      "invalid_flag",
    ],
    compressedFields: {},
    listSql: "SELECT * FROM model_configurations ORDER BY id DESC LIMIT $1 OFFSET $2",
    countSql: "SELECT COUNT(*)::integer AS count FROM model_configurations",
  },
  conversations: {
    columns: ["id", "title", "create_time", "update_time", "invalid_flag"],
    compressedFields: {},
    listSql: "SELECT * FROM conversations ORDER BY id DESC LIMIT $1 OFFSET $2",
    countSql: "SELECT COUNT(*)::integer AS count FROM conversations",
  },
  conversation_contexts: {
    columns: [
      "id",
      "conversation_id",
      "turn_id",
      "context_content",
      "covered_message_id",
      "create_time",
      "update_time",
      "invalid_flag",
    ],
    compressedFields: {
      context_content: "json",
    },
    listSql: "SELECT * FROM conversation_contexts ORDER BY id DESC LIMIT $1 OFFSET $2",
    countSql: "SELECT COUNT(*)::integer AS count FROM conversation_contexts",
    supportsConversationFilter: true,
  },
  messages: {
    columns: [
      "id",
      "conversation_id",
      "turn_id",
      "role",
      "model",
      "content",
      "thinking",
      "tool_calls_content",
      "error_message",
      "tool_calls_id",
      "parent_message_id",
      "tool_name",
      "tool_status",
      "tool_duration_ms",
      "create_time",
      "update_time",
      "invalid_flag",
    ],
    compressedFields: {
      content: "text",
      thinking: "text",
      tool_calls_content: "json",
      error_message: "text",
    },
    listSql: "SELECT * FROM messages ORDER BY id DESC LIMIT $1 OFFSET $2",
    countSql: "SELECT COUNT(*)::integer AS count FROM messages",
    supportsConversationFilter: true,
  },
  llm_calls: {
    columns: [
      "id",
      "conversation_id",
      "turn_id",
      "assistant_message_id",
      "provider",
      "model",
      "thinking_level",
      "input_content",
      "output_content",
      "thinking",
      "text_content",
      "tool_calls_content",
      "status",
      "error_message",
      "stop_reason",
      "input_tokens",
      "output_tokens",
      "cache_read_tokens",
      "cache_write_tokens",
      "total_tokens",
      "cost_input",
      "cost_output",
      "cost_cache_read",
      "cost_cache_write",
      "cost_total",
      "started_at",
      "finished_at",
      "duration_ms",
      "ttft_ms",
      "tps",
      "cache_ratio",
      "create_time",
      "update_time",
      "invalid_flag",
    ],
    compressedFields: {
      input_content: "text",
      output_content: "json",
      thinking: "text",
      text_content: "text",
      tool_calls_content: "json",
      error_message: "text",
    },
    listSql: "SELECT * FROM llm_calls ORDER BY id DESC LIMIT $1 OFFSET $2",
    countSql: "SELECT COUNT(*)::integer AS count FROM llm_calls",
    supportsConversationFilter: true,
  },
  tool_calls: {
    columns: [
      "id",
      "conversation_id",
      "turn_id",
      "assistant_message_id",
      "tool_name",
      "arguments",
      "result_content",
      "result_details",
      "status",
      "error_message",
      "started_at",
      "finished_at",
      "duration_ms",
      "create_time",
      "update_time",
      "invalid_flag",
    ],
    compressedFields: {
      arguments: "json",
      result_content: "text",
      result_details: "json",
      error_message: "text",
    },
    listSql: "SELECT * FROM tool_calls ORDER BY id DESC LIMIT $1 OFFSET $2",
    countSql: "SELECT COUNT(*)::integer AS count FROM tool_calls",
    supportsConversationFilter: true,
  },
};

/** 数据库查看器单表查询结果 */
export type InspectorResult = {
  table: InspectorTable;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * 判断一个值是否为 PostgreSQL 返回的二进制字段。
 */
function isBuffer(value: unknown): value is Buffer {
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
}

/** 将数据库时间显示为当前应用时区的完整日期时间。 */
function formatDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const milliseconds = String(value.getMilliseconds()).padStart(3, "0");
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}.${milliseconds}`;
}

/**
 * 解码查看器中的 gzip 字段。异常内容保留可读错误，不让整页查询失败。
 */
function decodeCompressed(value: unknown, kind: CompressedFieldKind): unknown {
  if (value === null || value === undefined) return null;

  if (!isBuffer(value)) return value;

  try {
    const text = decompressText(value);

    if (!text) return kind === "json" ? null : "";

    if (kind !== "json") return text;

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return "[gzip 解压失败]";
  }
}

/**
 * 将数据库值转换为可直接返回 JSON 的值。
 */
function serializeValue(
  value: unknown,
  field: string,
  compressedFields: Record<string, CompressedFieldKind>,
) {
  // 密钥永不通过查看器接口返回，避免管理页面或浏览器日志暴露凭据。
  if (field === "api_key" && value !== null && value !== undefined) return "********";

  if (field in compressedFields) {
    return decodeCompressed(value, compressedFields[field]);
  }

  if (value instanceof Date) return formatDateTime(value);
  if (isBuffer(value)) return `[二进制数据：${value.byteLength} bytes]`;

  return value;
}

/**
 * 查询一张表的记录，并解码其中的压缩字段。
 * @param table - 目标表名
 * @param limit - 每页最大条数
 * @param offset - 分页偏移
 * @param conversationId - 可选会话 ID，用于支持按会话过滤的表
 * @returns 列定义、解码后的行数据与总数
 */
export async function listInspectorRows(
  table: InspectorTable,
  limit: number,
  offset: number,
  conversationId?: string,
): Promise<InspectorResult> {
  const definition = TABLE_DEFINITIONS[table];
  const filterByConversation = Boolean(conversationId && definition.supportsConversationFilter);
  const listSql = filterByConversation
    ? definition.listSql.replace(" ORDER BY ", " WHERE conversation_id = $3::uuid ORDER BY ")
    : definition.listSql;
  const countSql = filterByConversation
    ? `${definition.countSql} WHERE conversation_id = $1::uuid`
    : definition.countSql;
  const listParams = filterByConversation ? [limit, offset, conversationId] : [limit, offset];
  const countParams = filterByConversation ? [conversationId] : [];
  const [rowsResult, countResult] = await Promise.all([
    pool.query<Record<string, unknown>>(listSql, listParams),
    pool.query<{ count: number }>(countSql, countParams),
  ]);

  return {
    table,
    columns: definition.columns,
    // SELECT * 仅用于避免维护两份 SQL；响应严格按当前定义白名单输出，
    // 已废弃的物理列不会通过数据库查看器暴露。
    rows: rowsResult.rows.map((row) =>
      Object.fromEntries(
        definition.columns.map((field) => [
          field,
          serializeValue(row[field], field, definition.compressedFields),
        ]),
      ),
    ),
    total: countResult.rows[0]?.count ?? 0,
    limit,
    offset,
  };
}
