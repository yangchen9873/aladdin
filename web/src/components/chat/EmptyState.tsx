/**
 * @fileoverview 空会话欢迎屏。
 */

import { WELCOME_PROMPT } from "../../lib/constants";

/**
 * 无消息时展示居中标题。
 * @returns 组件 JSX
 */
export function EmptyState() {
  return (
    <div className="flex flex-1 animate-empty-in flex-col items-center justify-center px-4 pb-32 pt-8">
      <div className="w-full max-w-content">
        <h1 className="welcome-title text-center text-3xl font-medium tracking-tight text-fg">
          {WELCOME_PROMPT}
        </h1>
      </div>
    </div>
  );
}
