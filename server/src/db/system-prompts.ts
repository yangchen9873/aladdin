/**
 * @fileoverview 系统提示词配置的数据库操作。
 */

import { pool } from "../shared/database.js";

/** 系统提示词单例的 UUIDv7 主键。 */
const SYSTEM_PROMPT_ID = "01a04e9c-540c-7405-8471-a0ecde4a37a9";

/**
 * 读取当前生效的系统提示词。
 *
 * @returns 保存的提示词；尚未配置或已逻辑删除时返回空字符串
 */
export async function getSystemPrompt(): Promise<string> {
  const result = await pool.query<{ content: string }>(
    "SELECT content FROM system_prompts WHERE id = $1::uuid AND invalid_flag = '0'",
    [SYSTEM_PROMPT_ID],
  );

  return result.rows[0]?.content ?? "";
}

/**
 * 保存唯一一条系统提示词配置。
 *
 * 使用固定主键实现单例配置；已存在的记录会被重新启用并覆盖内容。
 *
 * @param content - 完整且经过调用方校验的系统提示词
 * @returns 数据库实际保存的提示词
 */
export async function saveSystemPrompt(content: string): Promise<string> {
  const result = await pool.query<{ content: string }>(
    `INSERT INTO system_prompts (id, content)
     VALUES ($1::uuid, $2)
     ON CONFLICT (id) DO UPDATE
       SET content = EXCLUDED.content, update_time = now(), invalid_flag = '0'
     RETURNING content`,
    [SYSTEM_PROMPT_ID, content],
  );

  return result.rows[0]?.content ?? content;
}
