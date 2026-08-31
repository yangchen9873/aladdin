/**
 * @fileoverview 服务端配置入口：将环境变量映射为业务配置对象。
 */

import { loadEnvConfig } from "./env.js";

const env = loadEnvConfig();

/**
 * 全局运行时配置。
 *
 * 结构按业务域分组，路由 / LLM 层只依赖本对象，不直接读 `process.env`。
 */
export const config = {
  /** HTTP 监听端口 */
  port: env.PORT,
  /** 大模型相关 */
  llm: {
    /** pi-ai provider id，例如 `opencode-go` */
    provider: env.LLM_PROVIDER,
    /** 模型 id，例如 `mimo-v2.5` */
    model: env.LLM_MODEL,
    /** API Key（stream 时显式传入，不依赖各 provider 自带的 env 名） */
    apiKey: env.LLM_API_KEY,
    /** thinking / reasoning 级别 */
    thinkingLevel: env.LLM_THINKING_LEVEL,
    /** 自建网关地址，覆盖内置 baseUrl */
    baseUrl: env.LLM_BASE_URL,
    /** 自建网关模型名，覆盖请求体 model 字段 */
    modelAlias: env.LLM_MODEL_ALIAS,
    /** 模型配置 API Key 的数据库加密密钥 */
    configEncryptionKey: env.LLM_CONFIG_ENCRYPTION_KEY,
  },
  /** PostgreSQL */
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    schema: env.DB_SCHEMA,
  },
} as const;

/** 配置对象类型 */
export type AppConfig = typeof config;
