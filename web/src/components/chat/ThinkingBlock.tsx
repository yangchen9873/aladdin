/**
 * @fileoverview 可折叠的思考过程区块。
 */

import { useState } from "react";
import { Brain, LoaderCircle } from "lucide-react";
import { ICON_STROKE } from "../../lib/constants";

type ThinkingBlockProps = {
  /** 思考文本 */
  thinking: string;
  /** 是否仍在生成思考（影响标题文案） */
  active: boolean;
};

/**
 * 展示模型 reasoning / thinking，可展开收起。
 * @param props - 思考内容与激活态
 * @returns 组件 JSX
 */
export function ThinkingBlock({ thinking, active }: ThinkingBlockProps) {
  const [open, setOpen] = useState(active);
  const [prevActive, setPrevActive] = useState(active);

  // 思考进行中自动展开，结束后自动折叠
  if (active !== prevActive) {
    setPrevActive(active);
    setOpen(active);
  }

  if (!thinking && !active) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-fg-tertiary transition-colors hover:text-fg-secondary"
        onClick={() => setOpen((value) => !value)}
      >
        <Brain size={12} strokeWidth={ICON_STROKE} aria-hidden />
        {active ? "Thinking" : "Thought"}
        {active ? (
          <LoaderCircle
            size={12}
            strokeWidth={ICON_STROKE}
            className="animate-spin text-blue-600 dark:text-blue-400"
            aria-hidden
          />
        ) : null}
      </button>
      {open && thinking && (
        <div className="mt-2 origin-top animate-[expand-down_150ms_ease-out] whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-secondary">
          {thinking}
        </div>
      )}
    </div>
  );
}
