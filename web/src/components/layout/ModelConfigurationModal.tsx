/**
 * @fileoverview 文本模型配置弹窗。
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Plus,
  Save,
  Star,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  getTextModelConfiguration,
  deleteTextModelConfiguration,
  saveTextModelConfiguration,
  type CatalogModel,
  type TextModelConfiguration,
  type ThinkingLevel,
} from "../../api/model-configuration";
import { ICON_STROKE } from "../../lib/constants";
import { IconButton } from "../ui/IconButton";
import { useModalDismiss } from "../../hooks/useModalDismiss";

type Props = { onClose: () => void; onSaved: () => void };
type SearchableOption = { value: string; label: string; meta?: string };

const THINKING_LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Maximum" },
];

function ModelDetails({ model }: { model?: CatalogModel }) {
  if (!model) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-0.5 text-xs">
      <span className="rounded-md border border-border bg-muted px-2 py-1 text-fg-secondary">
        {model.reasoning ? "Reasoning" : "No reasoning"}
      </span>
      <span className="rounded-md border border-border bg-muted px-2 py-1 text-fg-secondary">
        {model.input.includes("image") ? "Text & Image" : "Text"}
      </span>
      <span
        data-numeric
        className="rounded-md border border-border bg-muted px-2 py-1 text-fg-secondary"
      >
        {Math.round(model.contextWindow / 1000)}K Context
      </span>
    </div>
  );
}

/** 带筛选的配置选择框，供 Provider、Model 和 Thinking Level 共用。 */
function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  searchable = true,
}: {
  value: string;
  options: SearchableOption[];
  placeholder: string;
  onChange: (value: string) => void;
  searchable?: boolean;
}) {
  const selected = options.find((option) => option.value === value);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open, selected?.label, value]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = !normalizedQuery
    ? options
    : options.filter((option) =>
        `${option.label} ${option.value}`.toLowerCase().includes(normalizedQuery),
      );

  const chooseOption = (option: SearchableOption) => {
    setQuery("");
    setOpen(false);
    onChange(option.value);
  };

  const handleNavigation = (event: KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;

    if (!open) {
      if (event.key === "Enter") return;
      event.preventDefault();
      setActiveIndex(event.key === "ArrowUp" ? Math.max(filtered.length - 1, 0) : 0);
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (filtered[activeIndex]) {
      event.preventDefault();
      chooseOption(filtered[activeIndex]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setActiveIndex(
            Math.max(
              options.findIndex((option) => option.value === value),
              0,
            ),
          );
          setOpen((current) => !current);
        }}
        onKeyDown={handleNavigation}
        className="flex h-10 w-full items-center rounded-md border border-border bg-surface px-3 pr-9 text-left font-mono text-sm font-normal outline-none focus:border-fg"
      >
        {selected?.label ?? placeholder}
      </button>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-3 text-fg-secondary"
        size={16}
      />
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {searchable ? (
            <div className="border-b border-border p-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleNavigation}
                placeholder={placeholder}
                className="h-8 w-full rounded-sm border border-border bg-surface px-2 text-sm outline-none placeholder:text-fg-tertiary focus:border-fg"
              />
            </div>
          ) : null}
          {filtered.length ? (
            filtered.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-hover ${index === activeIndex ? "bg-hover" : ""}`}
              >
                <span className="min-w-0 truncate font-mono text-sm">{option.label}</span>
                {option.meta ? (
                  <span className="shrink-0 text-xs text-fg-secondary">{option.meta}</span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-fg-secondary">没有匹配的选项</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 管理文本模型配置的弹窗。
 * @param props - 关闭和保存完成回调
 * @returns 组件 JSX
 */
export function ModelConfigurationModal({ onClose, onSaved }: Props) {
  const [value, setValue] = useState<TextModelConfiguration | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [configurations, setConfigurations] = useState<TextModelConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TextModelConfiguration | null>(null);
  const [page, setPage] = useState<"list" | "edit">("list");

  useModalDismiss(true, onClose);

  useEffect(() => {
    const controller = new AbortController();
    void getTextModelConfiguration(controller.signal)
      .then((data) => {
        setValue(data.configuration);
        setProviders(data.providers);
        setModels(data.models);
        setConfigurations(data.configurations);
      })
      .catch(
        (reason: unknown) =>
          !controller.signal.aborted &&
          setError(
            reason instanceof Error ? reason.message : "Failed to load model configuration.",
          ),
      )
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, []);

  const providerModels = useMemo(
    () =>
      models
        .filter((model) => model.provider === value?.provider)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [models, value?.provider],
  );
  const selectedModel = providerModels.find((model) => model.id === value?.model);

  const update = <K extends keyof TextModelConfiguration>(
    key: K,
    next: TextModelConfiguration[K],
  ) => {
    setValue((current) => (current ? { ...current, [key]: next } : current));
  };

  const changeProvider = (provider: string) => {
    setValue((current) =>
      current ? { ...current, provider, model: "", thinkingLevel: "off" } : current,
    );
  };

  const selectModel = (model: CatalogModel) => {
    setValue((current) =>
      current
        ? {
            ...current,
            model: model.id,
            thinkingLevel: model.reasoning ? current.thinkingLevel : "off",
          }
        : current,
    );
  };

  const save = async (makeDefault = false, target = value) => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveTextModelConfiguration({
        ...target,
        // 目录标记为不支持推理的模型，不能带非 off 的 thinking 设置进入聊天链路。
        thinkingLevel: models.find(
          (model) => model.provider === target.provider && model.id === target.model,
        )?.reasoning
          ? target.thinkingLevel
          : "off",
        isActive: makeDefault || target.isActive === "1" ? "1" : "0",
      });
      setValue(saved.configuration);
      setConfigurations(saved.configurations);
      onSaved();
      setPage("list");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to save model configuration.");
    } finally {
      setSaving(false);
    }
  };

  const createNewConfiguration = () => {
    setValue({
      kind: "text",
      label: "",
      provider: "openai",
      model: "gpt-5.4",
      apiKey: "",
      baseUrl: null,
      modelAlias: null,
      thinkingLevel: "medium",
      isActive: configurations.length === 0 ? "1" : "0",
    });
    setError(null);
    setPage("edit");
  };

  const invalidateConfiguration = async (configuration: TextModelConfiguration) => {
    if (!configuration.id || configuration.isActive === "1" || saving) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTextModelConfiguration(configuration.id);
      const data = await getTextModelConfiguration();
      setConfigurations(data.configurations);
      setValue(data.configuration);
      onSaved();
      setPendingDelete(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "作废配置失败");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-config-title"
        className="flex min-h-[560px] max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-popover shadow-md"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-border px-5 py-3">
          {page === "edit" ? (
            <button
              type="button"
              onClick={() => setPage("list")}
              className="grid size-8 place-items-center rounded-md text-fg-secondary hover:bg-hover hover:text-fg"
              title="返回模型配置"
              aria-label="返回模型配置"
            >
              <ArrowLeft size={17} strokeWidth={ICON_STROKE} />
            </button>
          ) : null}
          <div className="grid size-8 place-items-center rounded-md bg-muted text-fg-secondary">
            <SlidersHorizontal size={17} strokeWidth={ICON_STROKE} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="model-config-title" className="text-base font-semibold">
              {page === "list" ? "模型配置" : "编辑模型配置"}
            </h2>
            <p className="text-xs text-fg-secondary">
              {page === "list" ? "管理已保存的模型配置，或新建配置" : "配置连接信息与推理参数"}
            </p>
          </div>
          <IconButton aria-label="关闭 LLM 配置" title="关闭" onClick={onClose}>
            <X size={18} strokeWidth={ICON_STROKE} aria-hidden />
          </IconButton>
        </header>

        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-fg-secondary">
            <LoaderCircle size={16} className="animate-spin" />
            正在加载模型目录...
          </div>
        ) : value ? (
          page === "list" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <span aria-hidden />
                <button
                  type="button"
                  onClick={createNewConfiguration}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-semibold text-fg hover:bg-hover"
                >
                  <Plus size={15} strokeWidth={ICON_STROKE} aria-hidden /> 新建配置
                </button>
              </div>
              {configurations.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {configurations.map((configuration) => {
                    const selected = configuration.id === value.id;
                    return (
                      <div
                        key={configuration.id}
                        className={`group rounded-md border border-border p-3 ${selected ? "bg-muted" : "bg-surface"}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setValue(configuration);
                            setPage("edit");
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2 shrink-0 rounded-full ${configuration.isActive === "1" ? "bg-emerald-500" : "bg-fg-tertiary"}`}
                            />
                            <span className="truncate text-sm font-semibold">
                              {configuration.label || "未命名配置"}
                            </span>
                            <ChevronRight
                              size={15}
                              className="ml-auto text-fg-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden
                            />
                          </div>
                        </button>
                        <div className="mt-2 flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary">
                            {configuration.provider} / {configuration.model}
                          </p>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {configuration.isActive !== "1" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setValue(configuration);
                                  void save(true, configuration);
                                }}
                                disabled={saving}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-hover hover:text-fg disabled:opacity-50"
                                title="设为默认"
                              >
                                <Star size={12} />
                                默认
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setPendingDelete(configuration)}
                              disabled={configuration.isActive === "1" || saving}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              title={
                                configuration.isActive === "1"
                                  ? "请先设置其他配置为默认"
                                  : "删除配置"
                              }
                            >
                              <Trash2 size={12} />
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border-strong p-10 text-center text-sm text-fg-secondary">
                  点击右上角“新建配置”开始配置
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  配置名称
                  <input
                    value={value.label}
                    onChange={(event) => update("label", event.target.value)}
                    placeholder="Default chat model"
                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-normal outline-none placeholder:text-fg-tertiary focus:border-fg"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Provider
                  <SearchableSelect
                    value={value.provider}
                    options={providers.map((provider) => ({
                      value: provider,
                      label: provider,
                    }))}
                    placeholder="Search providers"
                    onChange={changeProvider}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-1.5 text-sm font-medium">
                <label htmlFor="model-id">Model</label>
                <SearchableSelect
                  value={value.model}
                  options={providerModels.map((model) => ({
                    value: model.id,
                    label: model.id,
                    meta: model.reasoning ? "Reasoning" : undefined,
                  }))}
                  placeholder="Search models, e.g. gpt-5.4"
                  onChange={(modelId) => {
                    const model = providerModels.find((item) => item.id === modelId);
                    if (model) selectModel(model);
                  }}
                />
                <ModelDetails model={selectedModel} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  API Key
                  <input
                    type="password"
                    autoComplete="off"
                    value={value.apiKey}
                    onChange={(event) => update("apiKey", event.target.value)}
                    placeholder="sk-..."
                    className="h-10 rounded-md border border-border bg-surface px-3 font-mono text-sm font-normal outline-none placeholder:font-sans placeholder:text-fg-tertiary focus:border-fg"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Thinking Level
                  <SearchableSelect
                    value={value.thinkingLevel ?? "off"}
                    options={THINKING_LEVELS.filter(
                      (level) => level.value === "off" || selectedModel?.reasoning,
                    ).map((level) => ({ value: level.value, label: level.label }))}
                    placeholder="Search thinking levels"
                    onChange={(level) => update("thinkingLevel", level as ThinkingLevel)}
                    searchable={false}
                  />
                </label>
              </div>
              <div className="mt-7 grid gap-4 border-t border-dashed border-border-strong pt-6">
                <label className="grid gap-1.5 text-sm font-medium">
                  Base URL <span className="text-[11px] font-normal text-fg-tertiary">可选</span>
                  <input
                    type="url"
                    value={value.baseUrl ?? ""}
                    onChange={(event) => update("baseUrl", event.target.value)}
                    placeholder="https://gateway.example.com/v1"
                    className="h-10 rounded-md border border-border bg-surface px-3 font-mono text-sm font-normal outline-none placeholder:font-sans placeholder:text-fg-tertiary focus:border-fg"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Model Alias{" "}
                  <span className="text-[11px] font-normal text-fg-tertiary">
                    可选，用于网关请求
                  </span>
                  <input
                    value={value.modelAlias ?? ""}
                    onChange={(event) => update("modelAlias", event.target.value)}
                    placeholder="网关实际接受的 Model 值"
                    className="h-10 rounded-md border border-border bg-surface px-3 font-mono text-sm font-normal outline-none placeholder:font-sans placeholder:text-fg-tertiary focus:border-fg"
                  />
                </label>
              </div>
              {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            </div>
          )
        ) : (
          <div className="p-5 text-sm text-destructive">{error ?? "未找到模型配置"}</div>
        )}
        {page === "edit" ? (
          <footer className="flex justify-end border-t border-border px-5 py-3">
            <button
              type="button"
              disabled={loading || saving || !value?.provider || !value?.model}
              onClick={() => void save()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-fg-inverse hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
              保存
            </button>
          </footer>
        ) : null}
      </section>
      {pendingDelete ? (
        <div
          className="absolute inset-0 z-20 grid place-items-center bg-overlay/60 p-5"
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-config-title"
            className="w-full max-w-sm rounded-md border border-border bg-popover p-5 shadow-lg"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 id="delete-config-title" className="text-sm font-semibold">
              删除模型配置？
            </h3>
            <p className="mt-2 text-sm text-fg-secondary">
              “{pendingDelete.label || pendingDelete.model}” 将从配置列表中移除。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-md border border-border px-3 py-2 text-sm text-fg-secondary hover:bg-hover"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void invalidateConfiguration(pendingDelete)}
                disabled={saving}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
