/**
 * @fileoverview 模型目录与当前文本模型配置接口。
 */

import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { getBuiltinModels, getBuiltinProviders } from "@earendil-works/pi-ai/providers/all";
import type { Context } from "hono";
import { config } from "../config/index.js";
import {
  getActiveModelConfiguration,
  getModelConfiguration,
  listModelConfigurations,
  deleteModelConfiguration,
  saveModelConfiguration,
  type ModelKind,
  type SavedModelConfiguration,
  type ThinkingLevel,
} from "../db/model-configurations.js";

const THINKING_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

function fallbackTextConfiguration(): SavedModelConfiguration {
  return {
    kind: "text",
    label: "",
    provider: "openai",
    model: "gpt-5.4",
    apiKey: "",
    baseUrl: null,
    modelAlias: null,
    thinkingLevel: "medium",
    isActive: "1",
  };
}

/**
 * 返回当前文本模型配置、候选配置和内置模型元数据。
 * @param c - Hono 请求上下文
 * @returns 当前配置、配置列表、数据来源与内置 provider/模型目录
 */
export async function getTextModelConfigurationHandler(c: Context) {
  const stored = await getActiveModelConfiguration("text");
  const value = stored ?? fallbackTextConfiguration();
  const configurations = await listModelConfigurations("text");
  return c.json({
    configuration: { ...value, apiKey: value.apiKey ? "********" : "" },
    configurations: configurations.map((item) => ({
      ...item,
      apiKey: "********",
    })),
    source: stored ? "database" : "environment",
    providers: getBuiltinProviders().sort(),
    models: getBuiltinProviders().flatMap((provider) =>
      getBuiltinModels(provider).map((model) => ({
        provider,
        id: model.id,
        name: model.name,
        reasoning: model.reasoning,
        thinkingLevels: getSupportedThinkingLevels(model),
        input: model.input,
        contextWindow: model.contextWindow,
      })),
    ),
  });
}

/**
 * 校验并保存文本模型配置。
 * @param c - Hono 请求上下文
 * @returns 保存后的配置与更新后的配置列表，或校验失败响应
 */
export async function updateTextModelConfigurationHandler(c: Context) {
  const body = await c.req.json<Partial<SavedModelConfiguration>>();
  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const requestedApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const existing = body.id
    ? await getModelConfiguration(body.id)
    : await getActiveModelConfiguration("text");
  const apiKey =
    requestedApiKey === "********" ? (existing?.apiKey ?? config.llm.apiKey) : requestedApiKey;
  const baseUrl =
    typeof body.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : null;
  const modelAlias =
    typeof body.modelAlias === "string" && body.modelAlias.trim() ? body.modelAlias.trim() : null;
  const thinkingLevel = typeof body.thinkingLevel === "string" ? body.thinkingLevel : "";

  if (!getBuiltinProviders().includes(provider as never))
    return c.json({ error: "未知 provider" }, 400);
  const catalogModel = getBuiltinModels(provider as never).find((entry) => entry.id === model);
  if (!catalogModel) return c.json({ error: "该 provider 不包含此模型" }, 400);
  if (!apiKey || apiKey === "********") return c.json({ error: "API Key is required" }, 400);
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      return c.json({ error: "Base URL 无效" }, 400);
    }
  }
  if (!thinkingLevel || !THINKING_LEVELS.includes(thinkingLevel as ThinkingLevel))
    return c.json({ error: "推理等级无效" }, 400);
  const supportedLevels = getSupportedThinkingLevels(catalogModel);
  if (!supportedLevels.includes(thinkingLevel as ThinkingLevel))
    return c.json(
      {
        error: `${provider}/${model} 不支持推理等级 "${thinkingLevel}"，可用：${supportedLevels.join("、")}`,
      },
      400,
    );

  const saved = await saveModelConfiguration({
    id: typeof body.id === "string" ? body.id : undefined,
    kind: "text" as ModelKind,
    label:
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim()
        : "Default chat model",
    provider,
    model,
    apiKey,
    baseUrl,
    modelAlias,
    thinkingLevel,
    isActive: body.isActive === "0" ? "0" : "1",
  });
  const configurations = await listModelConfigurations("text");
  return c.json({
    configuration: { ...saved, apiKey: "********" },
    configurations: configurations.map((item) => ({
      ...item,
      apiKey: "********",
    })),
    source: "database",
  });
}

/**
 * 逻辑删除指定文本模型配置并返回剩余配置。
 * @param c - Hono 请求上下文
 * @returns 剩余配置列表，或参数错误 / 业务规则拒绝响应
 */
export async function deleteTextModelConfigurationHandler(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "配置 ID 缺失" }, 400);
  const existing = await getModelConfiguration(id);
  if (!existing) return c.json({ error: "配置不存在" }, 404);
  if (existing.isActive === "1")
    return c.json({ error: "当前默认配置不能作废，请先设置其他配置为默认" }, 400);
  await deleteModelConfiguration(id, "text");
  return c.json({
    configurations: (await listModelConfigurations("text")).map((item) => ({
      ...item,
      apiKey: "********",
    })),
  });
}
