/**
 * @fileoverview 将 Mermaid 源码渲染为 SVG（流式过程中语法未完成时回退为代码块）。
 */

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";
import { CodeBlock } from "./CodeBlock";

type MermaidBlockProps = {
  /** Mermaid 源码 */
  source: string;
};

/**
 * 读取当前 `data-theme`。
 * @returns light / dark
 */
function readTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * 渲染单个 Mermaid 图。语法无效时显示原始代码。
 * @param props - Mermaid 源码
 * @returns 组件 JSX
 */
export function MermaidBlock({ source }: MermaidBlockProps) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(readTheme());
    });

    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      const renderId = `mermaid-${reactId}-${Date.now().toString(36)}`;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: theme === "dark" ? "dark" : "neutral",
      });

      void mermaid
        .render(renderId, source)
        .then((result) => {
          if (!cancelled) setSvg(result.svg);
        })
        .catch(() => {
          if (!cancelled) setSvg(null);
        });
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reactId, source, theme]);

  if (!svg) {
    return <CodeBlock language="mermaid" text={source} />;
  }

  return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />;
}
