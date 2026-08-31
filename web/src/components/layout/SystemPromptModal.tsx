/**
 * @fileoverview 系统提示词维护弹窗。
 */

import { useEffect, useState } from "react";
import { FilePenLine, LoaderCircle, Save, X } from "lucide-react";
import { createPortal } from "react-dom";
import { getSystemPrompt, updateSystemPrompt } from "../../api/system-prompt";
import { ICON_STROKE } from "../../lib/constants";
import { IconButton } from "../ui/IconButton";
import { useModalDismiss } from "../../hooks/useModalDismiss";

type SystemPromptModalProps = {
  /** 关闭弹窗。 */
  onClose: () => void;
  /** 保存成功后的回调。 */
  onSaved: () => void;
};

/**
 * 编辑并保存系统提示词。
 *
 * 在挂载时加载配置，并在卸载时取消未完成的加载请求。
 *
 * @param props - 弹窗事件回调
 * @returns 组件 JSX
 */
export function SystemPromptModal({ onClose, onSaved }: SystemPromptModalProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalDismiss(true, onClose);

  useEffect(() => {
    const controller = new AbortController();

    void getSystemPrompt(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setContent(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("提示词加载失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  /** 保存编辑内容，并在服务端确认成功后通知父组件。 */
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSystemPrompt(content);
      onSaved();
    } catch {
      setError("提示词保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-prompt-title"
        className="flex min-h-[480px] w-full max-w-3xl flex-col rounded-lg bg-popover shadow-md"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="grid size-8 place-items-center rounded-md bg-muted text-fg-secondary">
            <FilePenLine size={17} strokeWidth={ICON_STROKE} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="system-prompt-title" className="text-base font-semibold text-fg">
              系统提示词维护
            </h2>
            <p className="text-xs text-fg-secondary">编辑应用于所有新会话的系统指令。</p>
          </div>
          <IconButton aria-label="关闭提示词维护" title="关闭" onClick={onClose}>
            <X size={18} strokeWidth={ICON_STROKE} aria-hidden />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 p-5">
          {loading ? (
            <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-fg-secondary">
              <LoaderCircle size={16} className="animate-spin" aria-hidden />
              加载中...
            </div>
          ) : (
            <textarea
              aria-label="系统提示词"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="h-80 w-full resize-y rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-relaxed text-fg outline-none focus:border-primary"
            />
          )}
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-fg-inverse hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={saving || loading || !content.trim()}
          >
            {saving ? (
              <LoaderCircle size={15} className="animate-spin" aria-hidden />
            ) : (
              <Save size={15} aria-hidden />
            )}
            保存
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
