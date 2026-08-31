/**
 * @fileoverview 弹窗通用的 Escape 与遮罩关闭行为。
 */

import { useEffect } from "react";

/**
 * 在弹窗打开期间监听 Escape，并提供遮罩点击判断。
 * @param open - 弹窗是否打开
 * @param onClose - 关闭回调
 * @returns 判断事件是否点击遮罩本身的函数
 */
export function useModalDismiss(
  open: boolean,
  onClose: () => void,
  onEscape: () => boolean = () => false,
) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (!onEscape()) onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onEscape, open]);

  return (event: { target: EventTarget | null; currentTarget: EventTarget | null }) =>
    event.target === event.currentTarget && onClose();
}
