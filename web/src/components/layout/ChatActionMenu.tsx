/**
 * @fileoverview 对话行右侧「⋯」弹出菜单。
 */

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

type MenuPosition = {
  top: number;
  left: number;
};

type ChatActionMenuProps = {
  /** 是否打开 */
  open: boolean;
  /** 锚定的触发按钮 */
  anchorRef: RefObject<HTMLButtonElement | null>;
  /** 关闭菜单 */
  onClose: () => void;
  /** 点击删除 */
  onDelete: () => void;
};

/**
 * 锚定在触发按钮下方的操作菜单。
 * @param props - 开关状态、锚点与回调
 * @returns 组件 JSX
 */
export function ChatActionMenu({ open, anchorRef, onClose, onDelete }: ChatActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const anchor = anchorRef.current.getBoundingClientRect();

    setPosition({ top: anchor.bottom + 4, left: anchor.left });
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default border-0 bg-transparent"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <div
        ref={menuRef}
        style={{ top: position.top, left: position.left }}
        className="fixed z-[70] min-w-[140px] rounded-lg bg-popover p-1 shadow-md"
      >
        <button
          type="button"
          className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-hover"
          onClick={onDelete}
        >
          删除
        </button>
      </div>
    </>,
    document.body,
  );
}
