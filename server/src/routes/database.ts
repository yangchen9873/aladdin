/**
 * @fileoverview 数据库查看器接口。
 */

import type { Context } from "hono";
import { validate as isUuid } from "uuid";
import { INSPECTOR_TABLES, listInspectorRows, type InspectorTable } from "../db/inspector.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * 判断查询表名是否属于允许公开查看的白名单。
 * @param value - URL 路径中的表名
 * @returns 是否为合法查看器表
 */
function isInspectorTable(value: string): value is InspectorTable {
  return (INSPECTOR_TABLES as readonly string[]).includes(value);
}

/**
 * 解析非负整数查询参数，非法值回退到默认值。
 * @param value - 原始查询参数
 * @param fallback - 无效时使用的默认值
 * @returns 规范化后的非负整数
 */
function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * GET /api/database/:table —— 查询一张表，并返回已解压的字段。
 * @param c - Hono 请求上下文
 * @returns 表数据（含解压字段）或参数错误响应
 */
export async function getDatabaseTableHandler(c: Context) {
  const table = c.req.param("table");

  if (!table || !isInspectorTable(table)) {
    return c.json({ error: "table is invalid" }, 400);
  }

  const requestedLimit = parseNonNegativeInt(c.req.query("limit"), DEFAULT_LIMIT);

  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const offset = parseNonNegativeInt(c.req.query("offset"), 0);
  const conversationId = c.req.query("conversationId");

  if (conversationId && !isUuid(conversationId)) {
    return c.json({ error: "conversationId is invalid" }, 400);
  }

  const result = await listInspectorRows(table, limit, offset, conversationId);

  return c.json(result);
}
