/**
 * @fileoverview 聊天相关纯函数工具。
 */

import { v7 as uuidv7 } from "uuid";
import {
  CHAT_GROUP_ORDER,
  CHAT_GROUP_PREVIOUS_30_DAYS,
  CHAT_GROUP_PREVIOUS_7_DAYS,
  CHAT_GROUP_TODAY,
  CHAT_GROUP_YESTERDAY,
  CHAT_TITLE_MAX_LENGTH,
} from "../lib/constants";
import type { ChatGroup, Conversation, Message } from "../types/chat";

/**
 * 根据用户首条消息生成侧边栏标题。
 * @param text - 用户输入原文
 * @returns 截断后的标题
 */
export function titleFromPrompt(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();

  return compact.length > CHAT_TITLE_MAX_LENGTH
    ? `${compact.slice(0, CHAT_TITLE_MAX_LENGTH)}…`
    : compact;
}

/**
 * 浏览器本地时区下当天 00:00。
 * @param date - 时刻
 * @returns 本地零点时间戳
 */
function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * 创建日距今天的整日差（按浏览器时区，今天为 0）。
 * @param createdAt - 创建时刻
 * @param now - 当前时刻
 * @returns 非负日差；未来时刻视为 0
 */
function calendarDaysAgo(createdAt: Date, now: Date): number {
  const diff = Math.round((startOfLocalDay(now) - startOfLocalDay(createdAt)) / 86_400_000);

  return Math.max(diff, 0);
}

/**
 * 按浏览器本地日历得到侧边栏分组标签。
 * @param createdAt - 创建时刻
 * @param now - 当前时刻
 * @returns 分组文案
 */
function groupLabelFor(createdAt: Date, now: Date): string {
  const daysAgo = calendarDaysAgo(createdAt, now);

  if (daysAgo === 0) return CHAT_GROUP_TODAY;
  if (daysAgo === 1) return CHAT_GROUP_YESTERDAY;
  if (daysAgo < 7) return CHAT_GROUP_PREVIOUS_7_DAYS;
  if (daysAgo < 30) return CHAT_GROUP_PREVIOUS_30_DAYS;

  return createdAt.toLocaleDateString(undefined, {
    month: "long",
    year: createdAt.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * 将会话列表按浏览器时区的创建日折叠为侧边栏分组。
 * @param conversations - 本地会话（新的在前）
 * @param now - 分组基准时间
 * @returns 侧边栏分组
 */
export function toChatGroups(conversations: Conversation[], now = new Date()): ChatGroup[] {
  const buckets = new Map<string, ChatGroup["items"]>();

  for (const conversation of conversations) {
    const label = groupLabelFor(new Date(conversation.createdAt), now);
    const items = buckets.get(label) ?? [];

    items.push({ id: conversation.id, title: conversation.title });
    buckets.set(label, items);
  }

  const monthLabels = [...buckets.keys()].filter(
    (label) => !(CHAT_GROUP_ORDER as readonly string[]).includes(label),
  );

  return [...CHAT_GROUP_ORDER, ...monthLabels]
    .filter((label) => buckets.has(label))
    .map((label) => ({
      label,
      items: buckets.get(label) ?? [],
    }));
}

/**
 * 创建一条消息实体。
 * @param role - 角色
 * @param content - 正文
 * @param thinking - 助手思考内容（仅 assistant 需要）
 * @returns 新消息
 */
export function createMessage(role: "user", content: string): Message;
export function createMessage(role: "assistant", content: string, thinking: string): Message;
export function createMessage(role: Message["role"], content: string, thinking?: string): Message {
  if (role === "assistant") {
    if (thinking === undefined) {
      throw new Error("assistant message requires thinking");
    }

    return {
      id: uuidv7(),
      role,
      content,
      thinking,
      toolCalls: [],
    };
  }

  return {
    id: uuidv7(),
    role,
    content,
  };
}

/**
 * 更新指定会话中指定消息的字段。
 * @param conversations - 当前会话列表
 * @param chatId - 目标会话 ID
 * @param messageId - 目标消息 ID
 * @param patch - 需要合并的字段，或基于旧消息返回新字段的函数
 * @returns 更新后的会话列表
 */
export function patchMessage(
  conversations: Conversation[],
  chatId: string,
  messageId: string,
  patch: Partial<Message> | ((message: Message) => Partial<Message>),
): Conversation[] {
  return conversations.map((chat) => {
    if (chat.id !== chatId) return chat;

    return {
      ...chat,
      messages: chat.messages.map((message) => {
        if (message.id !== messageId) return message;

        const next = typeof patch === "function" ? patch(message) : patch;

        return { ...message, ...next };
      }),
    };
  });
}

type SessionIds = {
  chatId: string;
  userMessageId: string;
  assistantMessageId: string;
};

/**
 * 把乐观创建的会话 / 消息 ID 替换为服务端落库 ID。
 * @param conversations - 当前会话列表
 * @param from - 前端乐观 ID
 * @param to - 服务端 session 事件中的 ID 与标题
 * @returns 更新后的会话列表
 */
export function remapSessionIds(
  conversations: Conversation[],
  from: SessionIds,
  to: SessionIds & { title: string },
): Conversation[] {
  return conversations.map((chat) => {
    if (chat.id !== from.chatId) return chat;

    return {
      ...chat,
      id: to.chatId,
      // 仅新会话（本地乐观 ID → 服务端 ID）采用 session 标题；续聊保留首条标题
      title: from.chatId === to.chatId ? chat.title : to.title,
      messages: chat.messages.map((message) => {
        if (message.id === from.userMessageId) {
          return { ...message, id: to.userMessageId };
        }

        if (message.id === from.assistantMessageId) {
          return { ...message, id: to.assistantMessageId };
        }

        return message;
      }),
    };
  });
}
