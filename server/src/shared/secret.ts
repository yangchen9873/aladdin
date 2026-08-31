/**
 * @fileoverview 数据库敏感字段的对称加密。
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config/index.js";

const PREFIX = "aes-256-gcm:v1";

/**
 * 读取并校验模型配置加密密钥。
 * @returns 32 字节 AES 密钥
 * @throws {Error} 环境变量缺失或格式不合法时抛出异常
 */
function getEncryptionKey(): Buffer {
  const raw = config.llm.configEncryptionKey;
  if (!raw) {
    throw new Error("LLM_CONFIG_ENCRYPTION_KEY is required to save database model configurations");
  }

  const key = Buffer.from(raw, "base64");

  if (key.byteLength !== 32) {
    throw new Error("LLM_CONFIG_ENCRYPTION_KEY must be a Base64-encoded 32-byte key");
  }
  return key;
}

/**
 * 将 API Key 加密为包含版本、随机 IV 和认证标签的可存储字符串。
 * @param value - 待加密的明文 API Key
 * @returns 可持久化的密文
 */
export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * 解密数据库密文；旧明文记录会在下一次保存时自动升级为密文。
 * @param value - 数据库中的密文或历史明文
 * @returns 解密后的 API Key
 * @throws {Error} 密文格式错误或认证失败时抛出异常
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(`${PREFIX}.`)) return value;

  const [, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Stored model configuration API Key has an invalid encrypted format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
