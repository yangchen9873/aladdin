/**
 * @fileoverview 左侧会话列表侧边栏。
 */

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, PanelLeft, SquarePen } from "lucide-react";
import { cn } from "../../lib/cn";
import { ICON_STROKE } from "../../lib/constants";
import type { ChatGroup, ChatItem } from "../../types/chat";
import { IconButton } from "../ui/IconButton";
import { ChatSection } from "./ChatSection";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

type SidebarProps = {
  /** 是否折叠 */
  collapsed: boolean;
  /** 切换折叠 */
  onToggle: () => void;
  /** 当前对话 ID；无选中时为 null */
  activeChatId: string | null;
  /** 按时间分组的对话 */
  chatGroups: ChatGroup[];
  /** 选中对话 */
  onSelectChat: (id: string) => void;
  /** 新建对话 */
  onNewChat: () => void;
  /** 刷新对话列表 */
  onRefreshChats: () => void;
  /** 是否正在刷新对话列表 */
  refreshingChats: boolean;
  /** 是否存在更多历史会话 */
  hasMoreChats: boolean;
  /** 是否正在加载下一页 */
  loadingMoreChats: boolean;
  /** 加载下一页会话 */
  onLoadMoreChats: () => void;
  /** 删除对话 */
  onDeleteChat: (id: string) => void;
};

/**
 * 左侧边栏：新对话入口 + 历史列表。
 * @param props - 折叠状态与会话操作
 * @returns 组件 JSX
 */
export function Sidebar({
  collapsed,
  onToggle,
  activeChatId,
  chatGroups,
  onSelectChat,
  onNewChat,
  onRefreshChats,
  refreshingChats,
  hasMoreChats,
  loadingMoreChats,
  onLoadMoreChats,
  onDeleteChat,
}: SidebarProps) {
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatItem | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setOpenMenuChatId(null);

  const toggleMenu = (chatId: string) => {
    setOpenMenuChatId((current) => (current === chatId ? null : chatId));
  };

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || !hasMoreChats) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMoreChats();
      },
      { rootMargin: "160px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreChats, onLoadMoreChats]);

  return (
    <>
      <aside
        className={cn(
          "z-40 flex h-full shrink-0 flex-col border-r border-border-subtle bg-sidebar transition-[width,transform] duration-300 ease-out",
          collapsed
            ? "w-sidebar-collapsed items-center max-md:pointer-events-none max-md:absolute max-md:left-0 max-md:top-0 max-md:w-sidebar max-md:-translate-x-full"
            : "w-sidebar max-md:absolute max-md:left-0 max-md:top-0 max-md:shadow-md",
        )}
      >
        <div
          className={cn(
            "flex h-header shrink-0 items-center px-2.5",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <IconButton aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"} onClick={onToggle}>
            <PanelLeft size={20} strokeWidth={ICON_STROKE} aria-hidden />
          </IconButton>

          {!collapsed && (
            <IconButton aria-label="New Chat" onClick={onNewChat}>
              <SquarePen size={18} strokeWidth={ICON_STROKE} aria-hidden />
            </IconButton>
          )}
        </div>

        {collapsed ? (
          <div className="mt-1 flex flex-col items-center">
            <IconButton aria-label="New Chat" onClick={onNewChat}>
              <SquarePen size={18} strokeWidth={ICON_STROKE} aria-hidden />
            </IconButton>
          </div>
        ) : (
          <>
            <div className="px-2 pb-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-base text-fg transition-colors duration-150 hover:bg-fg/[0.045]"
                onClick={onNewChat}
              >
                <SquarePen size={16} strokeWidth={ICON_STROKE} aria-hidden />
                <span>New Chat</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-4">
              {chatGroups.map((group) => (
                <ChatSection
                  key={group.label}
                  label={group.label}
                  chats={group.items}
                  activeChatId={activeChatId}
                  openMenuChatId={openMenuChatId}
                  onSelectChat={onSelectChat}
                  onRefresh={onRefreshChats}
                  refreshing={refreshingChats}
                  onMenuToggle={toggleMenu}
                  onMenuClose={closeMenu}
                  onDeleteRequest={setPendingDelete}
                />
              ))}
              {hasMoreChats ? (
                <div
                  ref={loadMoreRef}
                  className="flex h-10 items-center justify-center"
                  aria-live="polite"
                >
                  {loadingMoreChats ? (
                    <LoaderCircle
                      size={16}
                      strokeWidth={ICON_STROKE}
                      className="animate-spin text-fg-tertiary"
                      aria-label="正在加载更多会话"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </aside>

      {pendingDelete && (
        <DeleteConfirmModal
          chat={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDeleteChat(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
}
