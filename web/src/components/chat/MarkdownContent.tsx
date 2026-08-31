/**
 * @fileoverview Markdown 正文渲染（GFM + 代码高亮 + Mermaid）。
 */

import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { CodeBlock } from "./CodeBlock";
import { MermaidBlock } from "./MermaidBlock";

/** 无 language 围栏时，用首行关键字识别 Mermaid */
const MERMAID_START =
  /^(mindmap|flowchart|sequenceDiagram|classDiagram|erDiagram|gantt|pie|gitGraph|journey|timeline|quadrantChart|sankey-beta|xychart-beta|block-beta|kanban|architecture-beta|radar-beta|treemap-beta)\b/;

/**
 * 判断围栏代码是否为 Mermaid。
 * @param language - 代码围栏语言
 * @param text - 源码
 * @returns 是否按 Mermaid 渲染
 */
function isMermaidFence(language: string, text: string): boolean {
  if (language === "mermaid") return true;

  return language === "" && MERMAID_START.test(text.trim());
}

/**
 * 从 `<pre>` 子节点取出围栏代码的语言与文本。
 * @param children - pre 的子节点
 * @returns 语言与源码；无法解析时为 null
 */
function extractFencedCode(children: ReactNode): { language: string; text: string } | null {
  const child = Children.toArray(children)[0];

  if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) {
    return null;
  }

  const className = child.props.className ?? "";
  const match = /language-([^\s]+)/.exec(className);
  const language = match ? match[1] : "";
  const text = String(child.props.children ?? "").replace(/\n$/, "");

  return { language, text };
}

/** 自定义节点映射：外链新窗口、高亮代码块、Mermaid 图、行内代码 */
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  pre: ({ children }) => {
    const fenced = extractFencedCode(children);

    if (!fenced) return <pre>{children}</pre>;

    if (isMermaidFence(fenced.language, fenced.text)) {
      return <MermaidBlock source={fenced.text} />;
    }

    return <CodeBlock language={fenced.language} text={fenced.text} />;
  },
  table: ({ children }) => (
    <div className="markdown-table">
      <table>{children}</table>
    </div>
  ),
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, "");
    const isBlock = Boolean(className) || text.includes("\n");

    if (!isBlock) return <code>{children}</code>;

    return <code className={className}>{text}</code>;
  },
};

type MarkdownContentProps = {
  /** Markdown 源文本 */
  content: string;
};

/**
 * 渲染助手回复中的 Markdown。
 * @param props - Markdown 文本
 * @returns 组件 JSX
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  if (!content) return null;

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
