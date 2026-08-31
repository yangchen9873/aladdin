/**
 * @fileoverview 对话删除确认弹窗。
 */

import { createPortal } from "react-dom";
import type { ChatItem } from "../../types/chat";
import { useModalDismiss } from "../../hooks/useModalDismiss";

type DeleteConfirmModalProps = {
  /** 待删除对话 */
  chat: ChatItem;
  /** 取消回调 */
  onCancel: () => void;
  /** 确认删除回调 */
  onConfirm: () => void;
};

/**
 * 屏幕居中的删除确认对话框。
 * @param props - 对话信息与确认/取消回调
 * @returns 组件 JSX
 */
export function DeleteConfirmModal({ chat, onCancel, onConfirm }: DeleteConfirmModalProps) {
  useModalDismiss(true, onCancel);

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        className="w-full max-w-sm rounded-2xl bg-popover p-6 shadow-md"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-modal-title" className="text-lg font-semibold text-fg">
          删除对话？
        </h2>
        <p className="mt-2 text-sm leading-normal text-fg-secondary">
          这将删除「{chat.title}」。此操作无法撤销。
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-hover"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive-hover"
            onClick={onConfirm}
          >
            删除
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
