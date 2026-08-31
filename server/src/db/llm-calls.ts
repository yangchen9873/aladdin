/**
 * @fileoverview LLM 调用记录的数据库操作。
 * 当前实现复用 turns.ts 的写入模型，后续可继续下沉 SQL。
 */

export { finishLlmCall, startLlmCall } from "./chat-writes.js";
export type { FinishLlmCallInput, StartLlmCallInput } from "./chat-writes.js";
