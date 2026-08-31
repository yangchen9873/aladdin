/**
 * @fileoverview 系统提示词维护 API。
 */

const SYSTEM_PROMPT_ENDPOINT = "/api/system-prompt";
import { requestJson } from "./http";

/** 系统提示词接口的成功和错误响应。 */
type SystemPromptResponse = {
  content?: string;
  error?: string;
};

/**
 * 请求系统提示词接口并提取返回内容。
 *
 * 接口异常响应也可能没有 JSON 内容，因此解析失败时保留 HTTP 状态错误。
 *
 * @param init - `fetch` 请求配置
 * @returns 服务端返回的系统提示词内容
 * @throws {Error} 请求未成功时抛出服务端错误或 HTTP 状态错误
 */
async function requestSystemPrompt(init?: RequestInit): Promise<string> {
  const body = await requestJson<SystemPromptResponse>(SYSTEM_PROMPT_ENDPOINT, init);

  return body.content ?? "";
}

/**
 * 获取当前系统提示词。
 *
 * @param signal - 用于在组件卸载时取消请求的信号
 * @returns 系统提示词；尚未配置时为空字符串
 */
export async function getSystemPrompt(signal?: AbortSignal): Promise<string> {
  return requestSystemPrompt({ signal });
}

/**
 * 保存系统提示词。
 *
 * @param content - 完整且非空的系统提示词
 * @returns 服务端保存后的内容
 */
export async function updateSystemPrompt(content: string): Promise<string> {
  return requestSystemPrompt({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}
