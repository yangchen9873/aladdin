/**
 * @fileoverview 可隔离错误的串行异步任务队列。
 */

/**
 * 创建按提交顺序执行的异步任务队列。
 * @param onError - 单个任务失败时的处理器
 * @returns 入队函数与等待队列完成的函数
 */
export function createSerialQueue(onError: (error: unknown) => void) {
  let tail = Promise.resolve();

  return {
    /**
     * 按提交顺序追加一个异步任务。
     * @param task - 要执行的持久化任务
     * @returns 无
     */
    enqueue(task: () => Promise<void>) {
      tail = tail.then(task).catch((error: unknown) => {
        try {
          onError(error);
        } catch (handlerError) {
          // 错误记录器异常时也不能破坏后续持久化任务。
          console.error("failed to handle serial queue error", handlerError);
        }
      });
    },

    /**
     * 等待当前队列中的全部任务完成。
     * @returns 队列尾部 Promise
     */
    flush() {
      return tail;
    },
  };
}
