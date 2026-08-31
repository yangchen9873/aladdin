/**
 * @fileoverview 环境变量加载与 Zod Schema。
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"),
  quiet: true,
});

/** 环境变量 Schema（字段名与 `.env` 对齐） */
export const envSchema = z.object({
  LLM_PROVIDER: z.string().min(1).optional(),
  LLM_MODEL: z.string().min(1).optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_THINKING_LEVEL: z
    .enum(["off", "minimal", "low", "medium", "high", "xhigh", "max"])
    .default("medium"),
  LLM_BASE_URL: z.url().optional(),
  LLM_MODEL_ALIAS: z.string().min(1).optional(),
  LLM_CONFIG_ENCRYPTION_KEY: z.string().min(1).optional(),

  PORT: z.coerce.number().int().positive().default(3002),

  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_SCHEMA: z.string().min(1).default("aladdin"),
});

/** 已解析环境变量类型 */
export type Env = z.infer<typeof envSchema>;

/**
 * 校验并返回环境变量；失败时抛出可读错误。
 * @returns 校验后的环境变量
 */
export function loadEnvConfig(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid server environment:\n${detail}`);
  }

  return parsed.data;
}
