/**
 * @fileoverview 消息行类型；messages 为对话时间线。
 */

import { decompressText } from "../shared/codec.js";

/** 解压后的消息 */
export type MessageRow = {
  messages_id: string;
  conversations_id: string;
  role: "user" | "assistant" | "tool";
  model: string | null;
  content: string;
  thinking: string;
  tool_calls_content: string;
  error_message: string;
  turn_id: string;
  tool_calls_id: string | null;
  parent_message_id: string | null;
  tool_name: string | null;
  tool_status: string | null;
  tool_duration_ms: number | null;
  created_at: Date;
};

/** 库中仍为 gzip 的消息 */
export type CompressedMessageRow = {
  messages_id: string;
  conversations_id: string;
  role: MessageRow["role"];
  model: string | null;
  content: Buffer | null;
  thinking: Buffer | null;
  tool_calls_content: Buffer | null;
  error_message: Buffer | null;
  turn_id: string;
  tool_calls_id: string | null;
  parent_message_id: string | null;
  tool_name: string | null;
  tool_status: string | null;
  tool_duration_ms: number | null;
  created_at: Date;
};

/**
 * 解压一条消息。
 * @param row - 压缩消息
 * @returns 解压后的消息行
 */
export function decodeMessage(row: CompressedMessageRow): MessageRow {
  return {
    messages_id: row.messages_id,
    conversations_id: row.conversations_id,
    role: row.role,
    model: row.model,
    content: decompressText(row.content),
    thinking: decompressText(row.thinking),
    tool_calls_content: decompressText(row.tool_calls_content),
    error_message: decompressText(row.error_message),
    turn_id: row.turn_id,
    tool_calls_id: row.tool_calls_id,
    parent_message_id: row.parent_message_id,
    tool_name: row.tool_name,
    tool_status: row.tool_status,
    tool_duration_ms: row.tool_duration_ms,
    created_at: row.created_at,
  };
}
