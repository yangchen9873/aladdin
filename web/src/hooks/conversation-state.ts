/**
 * @fileoverview 会话列表本地状态合并。
 */

import type { Conversation } from "../types/chat";

/**
 * 将服务端会话摘要页合并到本地状态，同时保留尚未同步完成的乐观会话。
 * 以 UUIDv7 主键倒序排列，保持分页加载与乐观创建的相同顺序。
 * @param current - 当前本地会话列表
 * @param rows - 服务端返回的摘要
 * @returns 合并后的会话列表
 */
export function mergeConversationSummaries(
  current: Conversation[],
  rows: Array<{ id: string; title: string; createdAt: number }>,
): Conversation[] {
  const localById = new Map(current.map((chat) => [chat.id, chat]));

  const fromServer: Conversation[] = rows.map((row) => {
    const existing = localById.get(row.id);

    return existing
      ? { ...existing, title: row.title, createdAt: row.createdAt }
      : { id: row.id, title: row.title, createdAt: row.createdAt, messages: [] };
  });

  const serverIds = new Set(rows.map((row) => row.id));
  const localOnly = current.filter((chat) => !serverIds.has(chat.id));

  // 服务端尚未返回的本地会话暂时保留，避免刷新覆盖正在创建的首轮对话。
  return [...localOnly, ...fromServer].sort((left, right) =>
    left.id < right.id ? 1 : left.id > right.id ? -1 : 0,
  );
}
