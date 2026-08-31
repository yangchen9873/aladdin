/**
 * @fileoverview 可扩展模型配置的数据访问。
 */

import { v7 as uuidv7 } from "uuid";
import { pool } from "../shared/database.js";
import { decryptSecret, encryptSecret } from "../shared/secret.js";

/** 支持的模型类型枚举值 */
export const MODEL_KINDS = ["text", "multimodal", "embedding", "rerank"] as const;
/** 模型类型 */
export type ModelKind = (typeof MODEL_KINDS)[number];
/** 推理 / thinking 等级 */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
/** 是否类标识。0=否，1=是 */
export type YesNoFlag = "0" | "1";

/** 完整模型配置（含解密后的 API Key） */
export type ModelConfiguration = {
  id: string;
  kind: ModelKind;
  label: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  modelAlias: string | null;
  thinkingLevel: ThinkingLevel;
  isActive: YesNoFlag;
};

/** 保存模型配置时的输入（id 可选，新建时省略） */
export type SavedModelConfiguration = Omit<ModelConfiguration, "id"> & {
  id?: string;
};

type ModelConfigurationRow = {
  id: string;
  kind: ModelKind;
  label: string;
  provider: string;
  model: string;
  api_key: string;
  base_url: string | null;
  model_alias: string | null;
  thinking_level: ThinkingLevel;
  is_active: YesNoFlag;
};

function toConfiguration(row: ModelConfigurationRow): ModelConfiguration {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    provider: row.provider,
    model: row.model,
    apiKey: decryptSecret(row.api_key),
    baseUrl: row.base_url,
    modelAlias: row.model_alias,
    thinkingLevel: row.thinking_level,
    isActive: row.is_active,
  };
}

/**
 * 获取指定类型当前启用的模型配置。
 * @param kind - 模型类型
 * @returns 配置，不存在时返回 null
 */
export async function getActiveModelConfiguration(
  kind: ModelKind,
): Promise<ModelConfiguration | null> {
  const result = await pool.query<ModelConfigurationRow>(
    `SELECT id, kind, label, provider, model, api_key, base_url, model_alias, thinking_level, is_active
     FROM model_configurations
     WHERE kind = $1 AND invalid_flag = '0' AND is_active = '1'
     ORDER BY id DESC LIMIT 1`,
    [kind],
  );
  return result.rows[0] ? toConfiguration(result.rows[0]) : null;
}

/**
 * 按 ID 获取模型配置。
 * @param id - 配置 ID
 * @returns 配置，不存在时返回 null
 */
export async function getModelConfiguration(id: string): Promise<ModelConfiguration | null> {
  const result = await pool.query<ModelConfigurationRow>(
    `SELECT id, kind, label, provider, model, api_key, base_url, model_alias, thinking_level, is_active
     FROM model_configurations
     WHERE id = $1::uuid AND invalid_flag = '0'`,
    [id],
  );
  return result.rows[0] ? toConfiguration(result.rows[0]) : null;
}

/**
 * 列出指定类型的有效模型配置。
 * @param kind - 模型类型
 * @returns 配置列表
 */
export async function listModelConfigurations(kind: ModelKind): Promise<ModelConfiguration[]> {
  const result = await pool.query<ModelConfigurationRow>(
    `SELECT id, kind, label, provider, model, api_key, base_url, model_alias, thinking_level, is_active
     FROM model_configurations
     WHERE kind = $1 AND invalid_flag = '0'
     ORDER BY id ASC`,
    [kind],
  );
  return result.rows.map(toConfiguration);
}

/**
 * 新增或更新模型配置，并维护默认配置唯一性。
 * @param value - 待保存配置
 * @returns 保存后的配置
 */
export async function saveModelConfiguration(
  value: SavedModelConfiguration,
): Promise<ModelConfiguration> {
  const id = value.id ?? uuidv7();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (value.isActive === "1") {
      await client.query(
        `UPDATE model_configurations
         SET is_active = '0', update_time = now()
         WHERE kind = $1 AND invalid_flag = '0' AND is_active = '1' AND id <> $2::uuid`,
        [value.kind, id],
      );
    }
    const result = await client.query<ModelConfigurationRow>(
      `INSERT INTO model_configurations
       (id, kind, label, provider, model, api_key, base_url, model_alias, thinking_level, is_active)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         label = EXCLUDED.label, provider = EXCLUDED.provider, model = EXCLUDED.model,
         api_key = EXCLUDED.api_key, base_url = EXCLUDED.base_url,
         model_alias = EXCLUDED.model_alias, thinking_level = EXCLUDED.thinking_level,
         is_active = EXCLUDED.is_active, update_time = now(), invalid_flag = '0'
       RETURNING id, kind, label, provider, model, api_key, base_url, model_alias, thinking_level, is_active`,
      [
        id,
        value.kind,
        value.label,
        value.provider,
        value.model,
        encryptSecret(value.apiKey),
        value.baseUrl || null,
        value.modelAlias || null,
        value.thinkingLevel,
        value.isActive,
      ],
    );
    await client.query("COMMIT");
    return toConfiguration(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 逻辑删除模型配置。
 * @param id - 配置 ID
 * @param kind - 模型类型
 * @returns 是否成功标记删除
 */
export async function deleteModelConfiguration(id: string, kind: ModelKind): Promise<boolean> {
  const result = await pool.query(
    `UPDATE model_configurations SET invalid_flag = '1', update_time = now()
     WHERE id = $1::uuid AND kind = $2 AND invalid_flag = '0'`,
    [id, kind],
  );
  return (result.rowCount ?? 0) > 0;
}
