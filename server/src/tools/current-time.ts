/**
 * @fileoverview 查询指定时区的当前时间。
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

/** 前端和审计记录使用的时间详情。 */
export type CurrentTimeDetails = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

const timeSchema = Type.Object({});

/**
 * 查询中国时区（Asia/Shanghai）的当前时间。
 * @returns 当前时间详情及可序列化的文本内容
 */
export const getCurrentTimeTool: AgentTool<typeof timeSchema, CurrentTimeDetails> = {
  name: "get_current_time",
  label: "查询时间",
  description: "查询中国当前时间，返回年月日、时分秒和星期。",
  parameters: timeSchema,
  execute: async (_toolCallId, params) => {
    // 先按固定时区生成可审计的当前时刻。
    const now = new Date();
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "long",
      hour12: false,
    }).formatToParts(now);

    // 将 Intl 分段结果转换为便于字段映射的对象。
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    // 构造稳定的工具详情结构，供前端展示和数据库审计复用。
    const details: CurrentTimeDetails = {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
      weekday: values.weekday ?? "",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
      details,
    };
  },
};
