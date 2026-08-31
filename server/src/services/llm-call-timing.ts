/**
 * @fileoverview LLM 流式调用的时间指标跟踪器。
 */

/** LLM 流式调用的首 token 延迟与生成吞吐指标 */
export type LlmTimingMetrics = {
  ttftMs: number | null;
  tps: number | null;
};

/**
 * 创建单轮聊天内复用的 LLM 调用计时器。
 * @returns 调用开始、首 token 标记和指标计算方法
 */
export function createLlmCallTimingTracker() {
  const startedAtPerf = new Map<string, number>();
  const startedAtWall = new Map<string, Date>();
  const firstTokenAt = new Map<string, number>();

  return {
    /**
     * 记录一次 LLM 调用开始，并返回写入数据库的墙钟时间。
     * @param callId - LLM 调用 ID
     * @returns 写入审计记录用的开始时间
     */
    start(callId: string): Date {
      const at = new Date();
      startedAtPerf.set(callId, performance.now());
      startedAtWall.set(callId, at);
      return at;
    },

    /**
     * 读取某次 LLM 调用开始时的墙钟时间。
     * @param callId - LLM 调用 ID
     * @returns 开始时间；未记录时返回当前时间
     */
    startedAtDate(callId: string): Date {
      return startedAtWall.get(callId) ?? new Date();
    },

    /**
     * 记录首个流式事件；重复调用不会覆盖真实首 token 时间。
     * @param callId - 当前 LLM 调用 ID
     * @returns 无
     */
    markFirstToken(callId: string | null): void {
      if (callId && !firstTokenAt.has(callId)) {
        firstTokenAt.set(callId, performance.now());
      }
    },

    /**
     * 计算首 token 延迟和生成吞吐率。
     * @param callId - LLM 调用 ID
     * @param outputTokens - 输出 token 数
     * @returns 可直接写入审计记录的指标
     */
    metrics(callId: string, outputTokens: number | null): LlmTimingMetrics {
      const now = performance.now();
      const started = startedAtPerf.get(callId) ?? now;
      const firstToken = firstTokenAt.get(callId);
      const generationMs = firstToken === undefined ? null : Math.max(now - firstToken, 1);

      return {
        ttftMs: firstToken === undefined ? null : Math.round(firstToken - started),
        tps:
          generationMs === null || outputTokens === null || outputTokens <= 0
            ? null
            : (outputTokens * 1000) / generationMs,
      };
    },
  };
}
