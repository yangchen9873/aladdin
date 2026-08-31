/**
 * @fileoverview 前端 HTTP 请求基础设施。
 */

/**
 * 发起 JSON 请求并统一解析服务端错误。
 *
 * @template T - 成功响应的数据结构
 * @param input - 请求地址或 Request
 * @param init - fetch 配置
 * @returns 解析后的 JSON 数据；204 响应返回 undefined
 * @throws {Error} HTTP 状态码非 2xx 时抛出包含服务端错误的异常
 */
export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => ({}))) as JsonErrorBody & T;

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  return body as T;
}

/**
 * 发起无需响应体的 JSON 请求。
 * @param input - 请求地址或 Request
 * @param init - fetch 配置
 * @returns 请求成功后结束，不返回响应数据
 * @throws {Error} HTTP 状态码非 2xx 时抛出异常
 */
export async function requestVoid(input: RequestInfo | URL, init?: RequestInit): Promise<void> {
  await requestJson<unknown>(input, init);
}
type JsonErrorBody = {
  error?: string;
};
