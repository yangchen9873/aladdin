/**
 * @fileoverview Agent 工具注册表。
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { getWeatherTool } from "./weather.js";
import { getCurrentTimeTool } from "./current-time.js";

/**
 * 当前注册给 Agent 的全部工具。
 *
 * 新工具应先在独立模块中实现并完成输入输出类型定义，再在此处集中注册，
 * 避免路由层直接依赖具体工具实现。
 */
export const agentTools: AgentTool[] = [getWeatherTool, getCurrentTimeTool];
