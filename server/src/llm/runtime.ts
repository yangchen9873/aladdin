/**
 * @fileoverview 使用 pi-ai 内置 provider 解析模型并创建运行时。
 */

import { type Api, type Model, type Models } from "@earendil-works/pi-ai";
import {
  builtinModels,
  getBuiltinModels,
  getBuiltinProviders,
} from "@earendil-works/pi-ai/providers/all";
import { config } from "../config/index.js";
import { getActiveModelConfiguration, getModelConfiguration } from "../db/model-configurations.js";

/** LLM 运行时配置（provider、模型、密钥与网关覆盖） */
export type LlmRuntimeConfig = {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string | null;
  modelAlias?: string | null;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | null;
};

/**
 * 读取当前启用的文本模型；没有数据库配置时回退到启动环境变量。
 * 每个聊天请求调用一次，使保存后的配置无需重启即可生效。
 * @param configurationId - 可选指定配置 ID；省略时使用当前启用的文本模型
 * @returns 合并后的 LLM 运行时配置
 */
export async function getTextRuntimeConfig(configurationId?: string): Promise<LlmRuntimeConfig> {
  const stored = configurationId
    ? await getModelConfiguration(configurationId)
    : await getActiveModelConfiguration("text");
  if (configurationId && !stored) throw new Error("text model configuration not found");
  return stored
    ? {
        provider: stored.provider,
        model: stored.model,
        apiKey: stored.apiKey,
        baseUrl: stored.baseUrl,
        modelAlias: stored.modelAlias,
        thinkingLevel: stored.thinkingLevel,
      }
    : config.llm;
}

/**
 * 应用 LLM_BASE_URL / LLM_MODEL_ALIAS 覆盖。
 * @param model - 内置目录解析出的模型
 * @returns 应用网关配置后的模型
 */
function resolveModel(model: Model<Api>, runtimeConfig: LlmRuntimeConfig): Model<Api> {
  const { baseUrl, modelAlias } = runtimeConfig;

  if (!baseUrl && !modelAlias) return model;

  return {
    ...model,
    ...(baseUrl ? { baseUrl } : {}),
    ...(modelAlias ? { id: modelAlias } : {}),
  };
}

/**
 * 未知模型时的错误文案（列出该 provider 已知模型预览）。
 * @param provider - provider id
 * @param modelId - 模型 id
 * @returns 错误信息
 */
function formatUnknownModel(provider: string, modelId: string): string {
  const known = getBuiltinModels(provider as Parameters<typeof getBuiltinModels>[0])
    .map((entry) => entry.id)
    .sort();
  const preview = known.slice(0, 20).join(", ");
  const more = known.length > 20 ? ` … (+${known.length - 20} more)` : "";

  return `Unknown model "${modelId}" for provider "${provider}". Known models: ${preview}${more}`;
}

/**
 * 按配置从内置目录解析模型。
 * @param runtimeConfig - LLM 运行时配置；省略时使用环境变量默认值
 * @returns models 集合与当前 model（api 由目录决定）
 */
export function createLlmRuntime(runtimeConfig: LlmRuntimeConfig = config.llm): {
  models: Models;
  model: Model<Api>;
} {
  const provider = runtimeConfig.provider ?? "openai";
  const modelId = runtimeConfig.model ?? "gpt-5.4";
  const models = builtinModels();
  const model = models.getModel(provider, modelId);

  if (!model) {
    const knownProviders = getBuiltinProviders();

    if ((knownProviders as string[]).includes(provider)) {
      throw new Error(formatUnknownModel(provider, modelId));
    }

    throw new Error(`Unknown provider "${provider}". Use one of: ${knownProviders.join(", ")}`);
  }

  return { models, model: resolveModel(model, runtimeConfig) };
}

/**
 * 带统一 API Key 的 streamSimple 封装。
 * @param models - Models 集合
 * @param model - 目标模型
 * @param context - 对话上下文
 * @param options - 流式选项
 * @param runtimeConfig - LLM 运行时配置；省略时使用环境变量默认值
 * @returns pi-ai 流式事件迭代器
 */
export function streamWithApiKey(
  models: Models,
  model: Model<Api>,
  context: Parameters<Models["streamSimple"]>[1],
  options?: Parameters<Models["streamSimple"]>[2],
  runtimeConfig: LlmRuntimeConfig = config.llm,
) {
  return models.streamSimple(resolveModel(model, runtimeConfig), context, {
    ...options,
    apiKey: runtimeConfig.apiKey,
    maxRetries: 5,
  });
}
