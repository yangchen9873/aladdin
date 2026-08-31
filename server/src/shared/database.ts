/**
 * @fileoverview PostgreSQL 连接池。
 */

import pg from "pg";
import { config } from "../config/index.js";

const { Pool } = pg;

/** 共享连接池 */
export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  options: `-c search_path=${assertIdent(config.db.schema)},public`,
});

/**
 * 校验 schema / 表名（仅允许字母数字下划线）。
 * @param ident - 标识符
 * @returns 原样返回
 */
function assertIdent(ident: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) {
    throw new Error(`Invalid SQL identifier: ${ident}`);
  }

  return ident;
}
