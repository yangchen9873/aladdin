/**
 * @fileoverview 数据库查看器：以表格形式展示已解压的业务数据。
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Database, LoaderCircle, RefreshCw, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  getDatabaseTable,
  DATABASE_TABLES,
  type DatabaseTableName,
  type DatabaseTableData,
} from "../../api/database";
import { ICON_STROKE } from "../../lib/constants";
import { IconButton } from "../ui/IconButton";
import { useModalDismiss } from "../../hooks/useModalDismiss";

const PAGE_SIZE = 50;

type DatabaseInspectorModalProps = {
  /** 是否显示 */
  open: boolean;
  /** 关闭查看器 */
  onClose: () => void;
};

type ExpandedCell = {
  column: string;
  value: string;
};

const LONG_CELL_LENGTH = 96;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return value;

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "[无法展示]";
    }
  }

  return String(value);
}

function tableLabel(table: DatabaseTableName): string {
  return DATABASE_TABLES.find((item) => item.name === table)?.label ?? table;
}

/** 将长字段压缩为单行预览。 */
function cellPreview(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * 可切换表、分页，并自动展示解压内容的数据库查看器。
 * @param props - 开关状态与关闭回调
 * @returns 组件 JSX
 */
export function DatabaseInspectorModal({ open, onClose }: DatabaseInspectorModalProps) {
  const [table, setTable] = useState<DatabaseTableName>("conversations");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<DatabaseTableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedCell, setExpandedCell] = useState<ExpandedCell | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const conversationIdFilter = table === "conversations" ? null : selectedConversationId;

  const handleClose = useCallback(() => {
    setSelectedConversationId(null);
    setOffset(0);
    setExpandedCell(null);
    onClose();
  }, [onClose]);

  const handleEscape = useCallback(() => {
    if (!expandedCell) return false;

    setExpandedCell(null);
    return true;
  }, [expandedCell]);

  useModalDismiss(open, handleClose, handleEscape);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const conversationFilter = table === "conversations" ? null : selectedConversationId;

    const loadTable = async () => {
      await Promise.resolve();

      if (controller.signal.aborted) return;

      setLoading(true);
      setError(null);

      try {
        const loaded = await getDatabaseTable(
          table,
          PAGE_SIZE,
          offset,
          conversationFilter,
          controller.signal,
        );

        if (!controller.signal.aborted) setData(loaded);
      } catch (reason: unknown) {
        if (controller.signal.aborted) return;

        console.error("failed to load database table", reason);
        setError("数据加载失败，请确认服务端和数据库连接正常。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadTable();

    return () => controller.abort();
  }, [conversationIdFilter, offset, open, reloadKey, selectedConversationId, table]);

  if (!open) return null;

  const currentData = data?.table === table && data.offset === offset ? data : null;
  const rows = currentData?.rows ?? [];
  const columns = currentData?.columns ?? [];
  const hasPreviousPage = offset > 0;
  const hasNextPage = currentData ? offset + rows.length < currentData.total : false;
  const waitingForData = loading || (!currentData && !error);

  return createPortal(
    <div
      className="modal-overlay p-3 sm:p-6"
      onMouseDown={(event) => {
        // 仅遮罩本身关闭，避免表格、按钮等内部操作误触关闭弹窗。
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="database-inspector-title"
        className="relative flex h-[1090px] w-[1600px] max-h-[calc(100vh-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl bg-popover shadow-md sm:max-h-[calc(100vh-3rem)] sm:max-w-[calc(100vw-3rem)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
          <Database size={18} strokeWidth={ICON_STROKE} aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="database-inspector-title" className="text-base font-semibold text-fg">
              数据查看器
            </h2>
            <p className="text-xs text-fg-tertiary">查看系统提示词、会话、消息与调用记录</p>
          </div>
          <IconButton
            aria-label="刷新数据"
            title="刷新数据"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            <RefreshCw size={17} strokeWidth={ICON_STROKE} aria-hidden />
          </IconButton>
          <IconButton aria-label="关闭数据查看器" title="关闭" onClick={handleClose}>
            <X size={19} strokeWidth={ICON_STROKE} aria-hidden />
          </IconButton>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 sm:px-4">
          {DATABASE_TABLES.map((item) => (
            <button
              key={item.name}
              type="button"
              className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${
                table === item.name
                  ? "bg-active font-medium text-fg"
                  : "text-fg-secondary hover:bg-hover hover:text-fg"
              }`}
              aria-pressed={table === item.name}
              onClick={() => {
                setTable(item.name);
                setOffset(0);
                setExpandedCell(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          className={
            selectedConversationId
              ? "flex min-h-9 shrink-0 items-center gap-2 border-b border-border-subtle bg-muted/50 px-4 py-1.5 text-xs text-fg-secondary sm:px-5"
              : "min-h-9 shrink-0"
          }
        >
          {selectedConversationId ? (
            <>
              <span>会话筛选</span>
              <code className="min-w-0 max-w-[min(100%,36rem)] truncate font-mono text-[11px] text-fg">
                {selectedConversationId}
              </code>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-fg-tertiary transition-colors hover:bg-hover hover:text-fg"
                onClick={() => {
                  setSelectedConversationId(null);
                  setOffset(0);
                }}
              >
                清除
              </button>
            </>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-surface">
          {waitingForData ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-fg-secondary">
              <LoaderCircle
                size={16}
                strokeWidth={ICON_STROKE}
                className="animate-spin"
                aria-hidden
              />
              加载中…
            </div>
          ) : error ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-fg-secondary">
              <p>{error}</p>
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-fg-inverse transition-colors hover:bg-primary-hover"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                重试
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-fg-tertiary">
              {tableLabel(table)}暂无数据
            </div>
          ) : (
            <table className="w-full min-w-max border-collapse text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-muted text-fg-secondary">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap border-b border-border px-3 py-2.5 font-medium"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={String(row[columns[0] ?? ""]) + rowIndex}
                    className={
                      table === "conversations" && row.id === selectedConversationId
                        ? "h-9 bg-active"
                        : "h-9 even:bg-muted/40"
                    }
                  >
                    {columns.map((column) => {
                      const value = column === "api_key" ? "********" : row[column];
                      const display = formatCell(value);
                      const preview = cellPreview(display);
                      const isLong = preview.length > LONG_CELL_LENGTH || display.includes("\n");
                      const isConversationId = table === "conversations" && column === "id";

                      return (
                        <td
                          key={column}
                          className="max-w-[360px] border-b border-border-subtle px-3 py-1.5 text-fg"
                        >
                          {isConversationId ? (
                            <button
                              type="button"
                              className="block w-full truncate text-left font-mono text-[11px] text-fg-secondary underline decoration-border-strong underline-offset-2 hover:text-fg"
                              title="选择此会话并筛选其关联数据"
                              onClick={() => {
                                setSelectedConversationId(display);
                                setOffset(0);
                              }}
                            >
                              {display}
                            </button>
                          ) : isLong ? (
                            <button
                              type="button"
                              className="block w-full truncate text-left font-mono text-[11px] leading-normal text-fg-secondary underline decoration-border-strong underline-offset-2 hover:text-fg"
                              title="点击查看完整内容"
                              onClick={() => setExpandedCell({ column, value: display })}
                            >
                              {preview}
                            </button>
                          ) : (
                            <span
                              className={`block truncate font-mono text-[11px] leading-normal ${
                                value === null ? "text-fg-tertiary" : ""
                              }`}
                            >
                              {preview}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 text-xs text-fg-secondary sm:px-5">
          <span>
            {currentData ? `${currentData.total} 条记录` : " "}
            {loading && currentData ? " · 更新中…" : ""}
          </span>
          <div className="flex items-center gap-1">
            <IconButton
              aria-label="上一页"
              title="上一页"
              disabled={!hasPreviousPage || loading}
              onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
            >
              <ChevronLeft size={16} strokeWidth={ICON_STROKE} aria-hidden />
            </IconButton>
            <span className="min-w-16 text-center">第 {Math.floor(offset / PAGE_SIZE) + 1} 页</span>
            <IconButton
              aria-label="下一页"
              title="下一页"
              disabled={!hasNextPage || loading}
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
            >
              <ChevronRight size={16} strokeWidth={ICON_STROKE} aria-hidden />
            </IconButton>
          </div>
        </div>

        {expandedCell ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-overlay p-6"
            onMouseDown={() => setExpandedCell(null)}
          >
            <section
              className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-md"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">
                  {expandedCell.column}
                </span>
                <IconButton
                  aria-label="关闭完整内容"
                  title="关闭"
                  onClick={() => setExpandedCell(null)}
                >
                  <X size={17} strokeWidth={ICON_STROKE} aria-hidden />
                </IconButton>
              </header>
              <pre className="min-h-0 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-fg">
                {expandedCell.value}
              </pre>
            </section>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
