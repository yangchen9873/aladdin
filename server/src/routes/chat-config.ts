/**
 * @fileoverview 聊天模型运行配置校验。
 */

import { getSupportedThinkingLevels, type Api, type Model } from "@earendil-works/pi-ai";
import type { LlmRuntimeConfig } from "../llm/runtime.js";

/**
 * 校验并返回模型支持的 thinking level。
 * @param model - 当前模型
 * @param runtimeConfig - LLM 运行配置
 * @returns 可用的 thinking level
 * @throws 配置级别不受模型支持时抛出异常
 */
export function resolveThinkingLevel(model: Model<Api>, runtimeConfig: LlmRuntimeConfig) {
  const configured = runtimeConfig.thinkingLevel;
  const level = configured || ("medium" as const);
  const supported = getSupportedThinkingLevels(model);

  if (!supported.includes(level)) {
    throw new Error(
      `LLM_THINKING_LEVEL "${level}" is not supported by ${model.provider}/${model.id}. Supported: ${supported.join(", ")}`,
    );
  }

  return level;
}
