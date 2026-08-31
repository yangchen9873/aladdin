/**
 * @fileoverview 当前文本模型配置 API。
 */

import { requestJson, requestVoid } from "./http";

/** 思考深度档位 */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/** 文本模型配置 */
export type TextModelConfiguration = {
  id?: string;
  kind: "text";
  label: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  modelAlias: string | null;
  thinkingLevel: ThinkingLevel;
  /** 0=否，1=是 */
  isActive: "0" | "1";
};

/** 目录中的模型条目 */
export type CatalogModel = {
  provider: string;
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  contextWindow: number;
};

type GetResponse = {
  configuration: TextModelConfiguration;
  configurations: TextModelConfiguration[];
  source: "database" | "environment";
  providers: string[];
  models: CatalogModel[];
  error?: string;
};

type SaveResponse = {
  configuration: TextModelConfiguration;
  configurations: TextModelConfiguration[];
  source: "database";
  error?: string;
};

const endpoint = "/api/model-configuration/text";

/**
 * 获取文本模型配置和可选模型列表。
 * @param signal - 可选取消信号
 * @returns 当前配置、全部配置、Provider 列表与模型目录
 */
export async function getTextModelConfiguration(signal?: AbortSignal): Promise<GetResponse> {
  return requestJson<GetResponse>(endpoint, { signal });
}

/**
 * 保存文本模型配置。
 * @param value - 配置内容
 * @returns 保存后的配置与全部配置列表
 */
export async function saveTextModelConfiguration(
  value: TextModelConfiguration,
): Promise<SaveResponse> {
  return requestJson<SaveResponse>(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

/**
 * 删除文本模型配置。
 * @param id - 配置 ID
 * @returns 删除完成时 resolve
 */
export async function deleteTextModelConfiguration(id: string): Promise<void> {
  await requestVoid(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
