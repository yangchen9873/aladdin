/**
 * @fileoverview 侧边栏单条对话行。
 */

import { useRef } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "../../lib/cn";
import { ICON_STROKE } from "../../lib/constants";
import type { ChatItem } from "../../types/chat";
import { ChatActionMenu } from "./ChatActionMenu";

type ChatRowProps = {
  /** 对话摘要 */
  chat: ChatItem;
  /** 是否为当前激活对话 */
  active: boolean;
  /** 菜单是否打开 */
  menuOpen: boolean;
  /** 选中对话 */
  onSelect: (id: string) => void;
  /** 切换菜单 */
  onMenuToggle: (id: string) => void;
  /** 关闭菜单 */
  onMenuClose: () => void;
  /** 发起删除确认 */
  onDeleteRequest: (chat: ChatItem) => void;
};

/**
 * 侧边栏对话条目（标题 + 操作菜单）。
 * @param props - 对话与交互回调
 * @returns 组件 JSX
 */
export function ChatRow({
  chat,
  active,
  menuOpen,
  onSelect,
  onMenuToggle,
  onMenuClose,
  onDeleteRequest,
}: ChatRowProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <li className="px-2">
      <div
        className={cn(
          "group relative rounded-md transition-[background-color,color] duration-150 ease-out hover:bg-fg/[0.045]",
          active && "bg-fg/[0.08]",
        )}
      >
        <button
          type="button"
          className="flex w-full items-center rounded-md px-2.5 py-2 pr-9 text-left text-[13px] leading-normal"
          onClick={() => onSelect(chat.id)}
        >
          <span className="truncate">{chat.title}</span>
        </button>

        <button
          ref={triggerRef}
          type="button"
          className={cn(
            "absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-fg-secondary transition-[opacity,background-color,color] hover:bg-fg/[0.08] hover:text-fg",
            menuOpen
              ? "bg-fg/[0.08] opacity-100"
              : "opacity-0 group-hover:opacity-100 max-md:size-8 max-md:opacity-100",
          )}
          aria-label={`${chat.title} 的操作菜单`}
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            onMenuToggle(chat.id);
          }}
        >
          <Ellipsis size={18} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>

      <ChatActionMenu
        open={menuOpen}
        anchorRef={triggerRef}
        onClose={onMenuClose}
        onDelete={() => {
          onMenuClose();
          onDeleteRequest(chat);
        }}
      />
    </li>
  );
}
