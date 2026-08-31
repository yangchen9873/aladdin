/**
 * @fileoverview 可折叠的工具调用区块。
 */

import { useEffect, useState } from "react";
import { Check, CircleStop, LoaderCircle, Wrench, X } from "lucide-react";
import { getToolCall } from "../../api/tool-calls";
import { cn } from "../../lib/cn";
import { ICON_STROKE } from "../../lib/constants";
import { formatDuration } from "../../lib/format";
import type { ToolCall } from "../../types/chat";

type ToolCallBlockProps = {
  /** 工具调用 */
  call: ToolCall;
};

/** 工具执行状态图标。 */
function StatusIcon({ status }: Pick<ToolCall, "status">) {
  const common = { size: 12, strokeWidth: ICON_STROKE, "aria-hidden": true } as const;

  if (status === "done")
    return <Check {...common} className="text-emerald-600 dark:text-emerald-400" />;
  if (status === "error") return <X {...common} className="text-destructive" />;
  if (status === "aborted") return <CircleStop {...common} className="text-fg-tertiary" />;

  return <LoaderCircle {...common} className="animate-spin text-blue-600 dark:text-blue-400" />;
}

/**
 * 展示一次工具调用：摘要 + 参数/结果。
 * @param props - 工具调用数据
 * @returns 组件 JSX
 */
export function ToolCallBlock({ call }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ToolCall | null>(null);
  const [detailError, setDetailError] = useState(false);

  const display = detail ?? call;
  const needsDetail = open && Boolean(call.toolCallId) && !call.result && !call.details;
  const loadingDetail = needsDetail && detail === null && !detailError;

  useEffect(() => {
    if (!open || !call.toolCallId || call.result || call.details) return;

    let cancelled = false;

    void getToolCall(call.toolCallId)
      .then((loaded) => {
        if (!cancelled) setDetail(loaded);
      })
      .catch((error: unknown) => {
        console.error("failed to load tool call detail", error);
        if (!cancelled) setDetailError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, call.toolCallId, call.result, call.details]);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1 text-xs text-fg-tertiary transition-colors hover:text-fg-secondary"
        onClick={() => setOpen((value) => !value)}
      >
        <Wrench size={12} strokeWidth={ICON_STROKE} aria-hidden />
        <span className={cn(call.status === "error" && "text-destructive")}>{display.name}</span>
        {typeof display.durationMs === "number" ? (
          <span className="text-[9px] text-fg-tertiary/70">
            {formatDuration(display.durationMs)}
          </span>
        ) : null}
        <StatusIcon status={call.status} />
      </button>

      {open && (
        <div className="mt-2 origin-top animate-[expand-down_150ms_ease-out] space-y-2 rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed text-fg-secondary">
          <div>
            <div className="mb-1 text-xs text-fg-tertiary">Arguments</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">
              {JSON.stringify(display.arguments, null, 2)}
            </pre>
          </div>

          {loadingDetail ? <p className="text-xs text-fg-tertiary">Loading result…</p> : null}

          {display.status === "done" && (display.details !== undefined || display.result) ? (
            <div>
              <div className="mb-1 text-xs text-fg-tertiary">Result</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">
                {display.details !== undefined
                  ? JSON.stringify(display.details, null, 2)
                  : display.result}
              </pre>
            </div>
          ) : null}

          {display.error ? <p className="text-destructive">{display.error}</p> : null}
        </div>
      )}
    </div>
  );
}
