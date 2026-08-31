/**
 * @fileoverview 系统提示词维护接口。
 */

import type { Context } from "hono";
import { getSystemPrompt, saveSystemPrompt } from "../db/system-prompts.js";

/**
 * 返回当前系统提示词。
 *
 * @param c - Hono 请求上下文
 * @returns 包含提示词内容的 JSON 响应
 */
export async function getSystemPromptHandler(c: Context) {
  return c.json({ content: await getSystemPrompt() });
}

/**
 * 校验并保存系统提示词。
 *
 * @param c - Hono 请求上下文
 * @returns 保存后的内容，或内容为空时的 400 响应
 */
export async function updateSystemPromptHandler(c: Context) {
  const body = await c.req.json<{ content?: unknown }>();
  if (typeof body.content !== "string" || !body.content.trim()) {
    return c.json({ error: "content is required" }, 400);
  }

  return c.json({ content: await saveSystemPrompt(body.content) });
}
