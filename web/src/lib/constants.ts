/**
 * @fileoverview 前端共享常量。
 */

/** Lucide 图标默认描边粗细 */
export const ICON_STROKE = 1.75;

/** 空状态与输入框占位文案 */
export const WELCOME_PROMPT = "How can I help you?";

/** 对话标题最大字符数 */
export const CHAT_TITLE_MAX_LENGTH = 24;

/** 侧边栏按创建时间分组的固定标签（更早的会话按月份） */
export const CHAT_GROUP_TODAY = "Today";
export const CHAT_GROUP_YESTERDAY = "Yesterday";
export const CHAT_GROUP_PREVIOUS_7_DAYS = "Previous 7 days";
export const CHAT_GROUP_PREVIOUS_30_DAYS = "Previous 30 days";

/** 侧边栏分组标签的固定排序 */
export const CHAT_GROUP_ORDER = [
  CHAT_GROUP_TODAY,
  CHAT_GROUP_YESTERDAY,
  CHAT_GROUP_PREVIOUS_7_DAYS,
  CHAT_GROUP_PREVIOUS_30_DAYS,
] as const;
