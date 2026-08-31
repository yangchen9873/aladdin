/**
 * @fileoverview 主区域顶部工具栏。
 */

import {
  Check,
  ChevronDown,
  Database,
  FilePenLine,
  Moon,
  PanelLeft,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Theme } from "../../hooks/useTheme";
import { ICON_STROKE } from "../../lib/constants";
import { IconButton } from "../ui/IconButton";

type ChatHeaderProps = {
  /** 当前主题 */
  theme: Theme;
  /** 是否显示打开侧栏按钮（折叠态移动端） */
  showMenuButton?: boolean;
  /** 打开侧栏 */
  onOpenSidebar?: () => void;
  /** 切换主题 */
  onToggleTheme: () => void;
  /** 打开数据库查看器 */
  onOpenDatabase: () => void;
  /** 打开系统提示词维护 */
  onOpenPromptMaintenance: () => void;
  /** 打开模型配置 */
  onOpenModelConfiguration: () => void;
  /** 可切换的模型配置 */
  modelConfigurations: { id: string; label: string; provider: string; model: string }[];
  /** 当前模型配置 */
  modelConfigurationId: string | null;
  /** 切换模型配置 */
  onModelConfigurationChange: (id: string) => void;
};

/**
 * 顶部栏：侧栏入口 + 主题切换。
 * @param props - 主题与侧栏控制
 * @returns 组件 JSX
 */
export function ChatHeader({
  theme,
  showMenuButton,
  onOpenSidebar,
  onToggleTheme,
  onOpenDatabase,
  onOpenPromptMaintenance,
  onOpenModelConfiguration,
  modelConfigurations,
  modelConfigurationId,
  onModelConfigurationChange,
}: ChatHeaderProps) {
  const isDark = theme === "dark";
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const selectedConfiguration = modelConfigurations.find(
    (item) => item.id === modelConfigurationId,
  );

  useEffect(() => {
    if (!modelMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!modelMenuRef.current?.contains(event.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [modelMenuOpen]);

  return (
    <header className="sticky top-0 z-10 flex h-header shrink-0 items-center bg-surface/80 px-3 backdrop-blur-sm md:px-4">
      {showMenuButton && (
        <IconButton className="md:hidden" aria-label="打开侧边栏" onClick={onOpenSidebar}>
          <PanelLeft size={20} strokeWidth={ICON_STROKE} aria-hidden />
        </IconButton>
      )}

      {modelConfigurations.length > 0 ? (
        <div ref={modelMenuRef} className="relative ml-1">
          <button
            type="button"
            onClick={() => setModelMenuOpen((open) => !open)}
            className="inline-flex max-w-44 items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-fg-secondary transition-colors hover:bg-hover hover:text-fg focus-visible:bg-hover focus-visible:outline-none"
            aria-label="选择聊天模型"
            aria-expanded={modelMenuOpen}
          >
            <span className="truncate">
              {selectedConfiguration ? selectedConfiguration.model : "选择模型"}
            </span>
            <ChevronDown
              size={14}
              strokeWidth={ICON_STROKE}
              aria-hidden
              className={`shrink-0 text-fg-tertiary transition-transform duration-150 ${modelMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {modelMenuOpen ? (
            <div className="absolute left-0 top-full z-30 mt-1.5 w-max min-w-[210px] max-w-[min(90vw,420px)] rounded-md border border-border bg-popover p-1 shadow-md">
              {modelConfigurations.map((configuration) => {
                const active = configuration.id === modelConfigurationId;
                return (
                  <button
                    key={configuration.id}
                    type="button"
                    onClick={() => {
                      onModelConfigurationChange(configuration.id);
                      setModelMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] transition-colors ${
                      active ? "bg-muted text-fg" : "text-fg-secondary hover:bg-hover hover:text-fg"
                    }`}
                  >
                    <span className="grid size-4 shrink-0 place-items-center text-fg-secondary">
                      {active ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {configuration.label || "Default chat model"}: {configuration.provider} /{" "}
                        {configuration.model}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <IconButton
        className="ml-auto"
        aria-label="打开数据查看器"
        title="数据查看器"
        onClick={onOpenDatabase}
      >
        <Database size={18} strokeWidth={ICON_STROKE} aria-hidden />
      </IconButton>

      <IconButton aria-label="LLM 配置" title="LLM 配置" onClick={onOpenModelConfiguration}>
        <SlidersHorizontal size={18} strokeWidth={ICON_STROKE} aria-hidden />
      </IconButton>

      <IconButton
        aria-label="系统提示词维护"
        title="系统提示词维护"
        onClick={onOpenPromptMaintenance}
      >
        <FilePenLine size={18} strokeWidth={ICON_STROKE} aria-hidden />
      </IconButton>

      <IconButton
        aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
        title={isDark ? "切换到浅色模式" : "切换到深色模式"}
        onClick={onToggleTheme}
      >
        {isDark ? (
          <Sun size={18} strokeWidth={ICON_STROKE} aria-hidden />
        ) : (
          <Moon size={18} strokeWidth={ICON_STROKE} aria-hidden />
        )}
      </IconButton>
    </header>
  );
}
