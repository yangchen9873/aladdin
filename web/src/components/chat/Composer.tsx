/**
 * @fileoverview 底部输入框（自动增高 + Enter 发送）。
 */

import { ArrowUp, Square } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "../../lib/cn";
import { formatRatio, formatTokens } from "../../lib/format";
import type { TokenUsage } from "../../types/chat";

type ComposerProps = {
  /** 受控输入值 */
  value: string;
  /** 输入变更 */
  onChange: (value: string) => void;
  /** 发送回调（传入已 trim 的文本） */
  onSend: (text: string) => void;
  /** 停止当前流式回复 */
  onStop: () => void;
  /** 是否正在流式输出 */
  streaming: boolean;
  /** 占位文案 */
  placeholder: string;
  /** 变化时重新聚焦输入框 */
  focusKey: number;
  /** 当前会话累计 token 用量 */
  tokenUsage: TokenUsage;
};

/** 文本框最大行数 */
const MAX_ROWS = 7;

/**
 * ChatGPT 风格输入区：自动增高、Enter 发送、Shift+Enter 换行。
 * @param props - 输入、发送与停止
 * @returns 组件 JSX
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  placeholder,
  focusKey,
  tokenUsage,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [multiline, setMultiline] = useState(false);

  const canSend = value.trim().length > 0;
  /** 清空并发送，随后聚焦回输入框 */
  const submit = () => {
    const text = value.trim();

    if (!text || streaming) return;

    onChange("");
    onSend(text);
    if (window.matchMedia("(max-width: 767px)").matches) {
      textareaRef.current?.blur();
    } else {
      queueMicrotask(() => textareaRef.current?.focus());
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  /** 按内容同步 textarea 高度 */
  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";

    const styles = getComputedStyle(el);
    const rowHeight = Number.parseFloat(styles.lineHeight);
    const padding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);

    const singleLine = rowHeight + padding;
    const maxHeight = rowHeight * MAX_ROWS + padding;
    const contentHeight = el.scrollHeight;
    const nextHeight = Math.min(Math.max(contentHeight, singleLine), maxHeight);

    el.style.height = `${nextHeight}px`;
    el.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";

    setMultiline(nextHeight > singleLine + 1);
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) return;
    textareaRef.current?.focus();
  }, [focusKey]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-surface from-55% to-transparent">
      <div className="mx-auto w-full max-w-content px-4 pb-0 pt-10">
        <div className="pointer-events-auto mx-auto w-full max-w-composer">
          <div className="composer-shell">
            <div className={cn("flex gap-2", multiline ? "items-end" : "items-center")}>
              <textarea
                ref={textareaRef}
                className="composer-input"
                rows={1}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="消息输入"
              />

              <button
                type="button"
                className={cn(
                  "btn-send",
                  streaming || canSend ? "btn-send-active" : "btn-send-idle",
                )}
                aria-label={streaming ? "停止" : "发送"}
                disabled={!streaming && !canSend}
                onClick={streaming ? onStop : submit}
              >
                {streaming ? (
                  <Square size={10} strokeWidth={0} fill="currentColor" aria-hidden />
                ) : (
                  <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
                )}
              </button>
            </div>
          </div>
          <div
            className="composer-usage"
            aria-label={`Current conversation token usage: Total ${formatTokens(tokenUsage.total)}, Input ${formatTokens(tokenUsage.input)}, Output ${formatTokens(tokenUsage.output)}, Cache ${formatTokens(tokenUsage.cache)}, Cache Ratio ${formatRatio(tokenUsage.cacheRatio)}, Context Usage ${formatRatio(tokenUsage.contextRatio)}`}
          >
            <span>Total {formatTokens(tokenUsage.total)}</span>
            <span>Input {formatTokens(tokenUsage.input)}</span>
            <span>Output {formatTokens(tokenUsage.output)}</span>
            <span>Cache {formatTokens(tokenUsage.cache)}</span>
            <span>Cache Ratio {formatRatio(tokenUsage.cacheRatio)}</span>
            <span>Context Usage {formatRatio(tokenUsage.contextRatio)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
