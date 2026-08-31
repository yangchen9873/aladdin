/**
 * @fileoverview 聊天领域类型定义。
 */

/** 侧边栏中的单条对话摘要 */
export type ChatItem = {
  /** 对话唯一 ID */
  id: string;
  /** 展示标题 */
  title: string;
};

/** 按时间分组的对话列表 */
export type ChatGroup = {
  /** 分组标题，例如 Today / Yesterday */
  label: string;
  /** 该组下的对话 */
  items: ChatItem[];
};

/** 工具调用状态 */
export type ToolCallStatus = "running" | "done" | "error" | "aborted";

/** 当前会话累计的模型 token 用量 */
export type TokenUsage = {
  /** 总 token */
  total: number;
  /** 输入 token */
  input: number;
  /** 输出 token */
  output: number;
  /** 缓存读取 token */
  cache: number;
  /** 缓存命中比例（0 到 1） */
  cacheRatio: number;
  /** 最近一次请求占模型上下文窗口的比例（0 到 1） */
  contextRatio: number;
};

/** 展示在消息里的一次工具调用（摘要；详情走 /api/tool-calls/:id） */
export type ToolCall = {
  /** 审计表 ID，拉详情用 */
  toolCallId?: string;
  /** 模型侧 tool call id */
  id: string;
  /** 工具名 */
  name: string;
  /** 调用参数 */
  arguments?: unknown;
  /** 回给模型的文本（流式或详情接口才有） */
  result?: string | null;
  /** 结构化结果（流式或详情接口才有） */
  details?: unknown;
  /** 状态 */
  status: ToolCallStatus;
  /** 失败原因 */
  error?: string;
  /** 耗时毫秒 */
  durationMs?: number | null;
};

/** 线程中的一条消息 */
export type Message = {
  /** 消息唯一 ID */
  id: string;
  /** 角色 */
  role: "user" | "assistant";
  /** 助手消息使用的模型名称 */
  model?: string;
  /** 正文内容 */
  content: string;
  /** 模型思考过程（助手消息始终有该字段） */
  thinking?: string;
  /** 调用失败原因（仅助手消息，成功时无此字段） */
  error?: string;
  /** 本轮工具调用（仅助手消息） */
  toolCalls?: ToolCall[];
};

/** 本地会话（摘要 + 消息列表） */
export type Conversation = ChatItem & {
  /** 创建时刻（Unix 毫秒）；侧边栏按浏览器时区的日历日分组 */
  createdAt: number;
  /** 会话消息 */
  messages: Message[];
};
