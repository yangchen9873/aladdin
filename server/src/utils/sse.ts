/**
 * @fileoverview SSE 写出辅助。
 */

/** 聊天接口推送给前端的事件载荷 */
export type SsePayload =
  | {
      type: "session";
      conversationId: string;
      title: string;
      userMessageId: string;
      assistantMessageId: string;
      model: string;
    }
  | { type: "delta"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "assistant_start"; assistantMessageId: string; model: string }
  | {
      type: "tool_start";
      id: string;
      name: string;
      arguments: unknown;
    }
  | {
      type: "tool_end";
      id: string;
      name: string;
      result: string | null;
      details: unknown;
      isError: boolean;
      error?: string;
      durationMs: number | null;
    }
  | {
      type: "usage";
      total: number | null;
      input: number | null;
      output: number | null;
      cache: number | null;
      contextRatio: number | null;
    }
  | { type: "done" }
  | { type: "error"; message: string };

/** SSE 写出器公开的操作。 */
export type SseWriter = {
  send: (payload: SsePayload) => void;
  close: () => void;
};

/**
 * 创建带关闭保护的 SSE writer。
 * @param controller - ReadableStream 控制器
 * @returns send / close 方法
 */
export function createSseWriter(
  controller: ReadableStreamDefaultController<Uint8Array>,
): SseWriter {
  const encoder = new TextEncoder();
  let closed = false;

  return {
    /**
     * 写入一条 `data:` 事件。
     * @param payload - 业务载荷
     * @returns 无；writer 已关闭时忽略写入
     */
    send(payload: SsePayload) {
      if (closed) return;

      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      } catch {
        closed = true;
      }
    },
    /**
     * 关闭流（幂等）。客户端断开时底层控制器可能已关闭，此时忽略异常。
     * @returns 无
     */
    close() {
      if (closed) return;

      closed = true;

      try {
        controller.close();
      } catch {
        // client already disconnected
      }
    },
  };
}

/** SSE 响应头 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;
