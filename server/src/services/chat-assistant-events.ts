/**
 * @fileoverview Agent 助手消息增量事件处理。
 */

/** Agent 助手消息增量事件联合类型 */
export type AssistantUpdate =
  | { type: "thinking_delta"; delta: string }
  | { type: "text_delta"; delta: string }
  | {
      type: "error";
      error?: string | { errorMessage?: string; message?: string };
      errorMessage?: string;
      message?: string;
    };

/** 助手增量事件处理回调集合 */
export type AssistantUpdateHandlers = {
  markFirstToken: () => void;
  sendThinking: (delta: string) => void;
  sendText: (delta: string) => void;
  sendError: (message: string) => void;
};

/**
 * 处理 Agent 的助手消息增量，并将统一格式的事件写入 SSE。
 * @param update - Agent 返回的助手增量事件
 * @param handlers - 增量状态与 SSE 输出回调
 * @returns 无
 */
export function handleAssistantUpdate(
  update: AssistantUpdate,
  handlers: AssistantUpdateHandlers,
): void {
  if (update.type === "thinking_delta") {
    handlers.markFirstToken();
    handlers.sendThinking(update.delta);
    return;
  }

  if (update.type === "text_delta") {
    handlers.markFirstToken();
    handlers.sendText(update.delta);
    return;
  }

  const errorMessage =
    typeof update.error === "string"
      ? update.error
      : (update.error?.errorMessage ??
        update.error?.message ??
        update.errorMessage ??
        update.message);

  // 部分模型会发送空 error 事件作为提示，但随后仍会正常输出正文。
  if (errorMessage) handlers.sendError(errorMessage);
}
