/**
 * @fileoverview 侧边栏对话分组区块。
 */

import type { ChatItem } from "../../types/chat";
import { CHAT_GROUP_TODAY } from "../../lib/constants";
import { RefreshCw } from "lucide-react";
import { ChatRow } from "./ChatRow";
import { IconButton } from "../ui/IconButton";

type ChatSectionProps = {
  /** 分组标题 */
  label: string;
  /** 该组对话 */
  chats: ChatItem[];
  /** 当前激活对话 ID */
  activeChatId: string | null;
  /** 当前打开菜单的对话 ID */
  openMenuChatId: string | null;
  /** 选中对话 */
  onSelectChat: (id: string) => void;
  /** 刷新对话列表 */
  onRefresh: () => void;
  /** 是否正在刷新对话列表 */
  refreshing: boolean;
  /** 切换菜单 */
  onMenuToggle: (id: string) => void;
  /** 关闭菜单 */
  onMenuClose: () => void;
  /** 发起删除确认 */
  onDeleteRequest: (chat: ChatItem) => void;
};

/**
 * 带标题的对话列表分组。
 * @param props - 分组数据与交互回调
 * @returns 组件 JSX
 */
export function ChatSection({
  label,
  chats,
  activeChatId,
  onRefresh,
  refreshing,
  openMenuChatId,
  onSelectChat,
  onMenuToggle,
  onMenuClose,
  onDeleteRequest,
}: ChatSectionProps) {
  if (chats.length === 0) return null;

  return (
    <section className="mb-3 first:pt-0">
      <div className="flex items-center justify-between px-3.5 pb-1.5 pt-3 text-sm font-medium text-fg-tertiary">
        <span>{label}</span>
        {label === CHAT_GROUP_TODAY ? (
          <IconButton
            className="size-7"
            aria-label="刷新会话"
            title="刷新会话"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw
              size={14}
              strokeWidth={1.8}
              className={refreshing ? "animate-spin" : undefined}
            />
          </IconButton>
        ) : null}
      </div>
      <ul className="space-y-0.5">
        {chats.map((chat) => (
          <ChatRow
            key={chat.id}
            chat={chat}
            active={activeChatId === chat.id}
            menuOpen={openMenuChatId === chat.id}
            onSelect={onSelectChat}
            onMenuToggle={onMenuToggle}
            onMenuClose={onMenuClose}
            onDeleteRequest={onDeleteRequest}
          />
        ))}
      </ul>
    </section>
  );
}
