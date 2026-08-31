/**
 * @fileoverview 带语言标签、复制按钮和语法高亮的围栏代码块。
 */

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import hljs from "highlight.js/lib/common";
import { ICON_STROKE } from "../../lib/constants";

type CodeBlockProps = {
  /** 围栏语言，可为空 */
  language: string;
  /** 源码 */
  text: string;
};

/**
 * 将源码转义为可安全插入 HTML 的文本。
 * @param text - 源码
 * @returns 转义后的字符串
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * 按语言高亮源码；未知语言或高亮失败时回退为转义文本。
 * @param language - 围栏语言
 * @param text - 源码
 * @returns 高亮 HTML
 */
function highlight(language: string, text: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(text, { language, ignoreIllegals: true }).value;
    }
  } catch {
    // 流式半截代码或未知语言时回退
  }

  return escapeHtml(text);
}

/**
 * 渲染带工具栏的语法高亮代码块。
 * @param props - 语言与源码
 * @returns 组件 JSX
 */
export function CodeBlock({ language, text }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlight(language, text), [language, text]);

  useEffect(() => {
    if (!copied) return;

    const timer = window.setTimeout(() => setCopied(false), 1500);

    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      (error: unknown) => {
        console.error("failed to copy code", error);
      },
    );
  };

  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span className="min-w-0 truncate">{language || "code"}</span>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 text-fg-tertiary transition-colors hover:text-fg"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <Check size={13} strokeWidth={ICON_STROKE} aria-hidden />
          ) : (
            <Copy size={13} strokeWidth={ICON_STROKE} aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
