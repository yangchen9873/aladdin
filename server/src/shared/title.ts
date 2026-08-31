/**
 * @fileoverview 会话标题截断。
 */

/** 自动生成标题的最大字符数 */
export const TITLE_MAX_LENGTH = 24;

/** 数据库 conversations.title 字段上限 */
export const CONVERSATION_TITLE_MAX_LENGTH = 64;

/**
 * 截断为可写入数据库的会话标题。
 * @param title - 原始标题
 * @returns 不超过字段上限的标题
 */
export function normalizeConversationTitle(title: string): string {
  return title.length > CONVERSATION_TITLE_MAX_LENGTH
    ? title.slice(0, CONVERSATION_TITLE_MAX_LENGTH)
    : title;
}

/**
 * 用用户首条消息生成标题。
 * @param text - 用户输入
 * @returns 截断后的标题
 */
export function titleFromPrompt(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();

  return compact.length > TITLE_MAX_LENGTH ? `${compact.slice(0, TITLE_MAX_LENGTH)}…` : compact;
}
