/**
 * @fileoverview Agent 服务入口。
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config/index.js";
import { createLlmRuntime } from "./llm/runtime.js";
import {
  getTextModelConfigurationHandler,
  updateTextModelConfigurationHandler,
  deleteTextModelConfigurationHandler,
} from "./routes/model-configurations.js";
import { createChatHandler } from "./routes/chat.js";
import { getDatabaseTableHandler } from "./routes/database.js";
import {
  deleteConversationHandler,
  getConversationHandler,
  listConversationsHandler,
} from "./routes/conversations.js";
import { getToolCallHandler } from "./routes/tool-calls.js";
import { getSystemPromptHandler, updateSystemPromptHandler } from "./routes/system-prompts.js";

const app = new Hono();
const { models, model } = createLlmRuntime();

// 统一配置跨域策略，供本地前端开发环境访问服务端接口。
app.use(
  "*",
  cors({
    origin: ["http://localhost:5174", "http://127.0.0.1:5174"],
  }),
);

// 健康检查不依赖数据库和模型，便于容器探活。
app.get("/health", (c) => c.json({ ok: true }));

// 注册只读查询与会话维护路由。
app.get("/api/conversations", listConversationsHandler);
app.get("/api/conversations/:id", (c) => getConversationHandler(c, model));
app.delete("/api/conversations/:id", deleteConversationHandler);
app.get("/api/tool-calls/:id", getToolCallHandler);
app.get("/api/database/:table", getDatabaseTableHandler);
app.get("/api/system-prompt", getSystemPromptHandler);
app.put("/api/system-prompt", updateSystemPromptHandler);
app.get("/api/model-configuration/text", getTextModelConfigurationHandler);
app.put("/api/model-configuration/text", updateTextModelConfigurationHandler);
app.delete("/api/model-configuration/text/:id", deleteTextModelConfigurationHandler);

// 聊天路由独立创建 handler，确保每次请求使用统一的模型运行时。
app.post("/api/chat", createChatHandler());

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`listening on http://localhost:${info.port}`);
  },
);
