/**
 * @fileoverview `POST /api/chat` —— 只接收本轮用户输入，历史从数据库加载。
 * 流式开始前 startTurn 落库，结束后 finishTurn 回写；历史仅服务端解压给模型。
 */

import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { type Api, type AssistantMessage, type Model, type Models } from "@earendil-works/pi-ai";
import type { Context } from "hono";
import { v7 as uuidv7, validate as isUuid } from "uuid";
import { getLatestConversationContext } from "../db/contexts.js";
import { conversationExists } from "../db/conversations.js";
import { normalizeConversationTitle, titleFromPrompt } from "../shared/title.js";
import { finishToolCall, startToolCall } from "../db/tool-calls.js";
import { finishLlmCall, startLlmCall } from "../db/llm-calls.js";
import {
  finishTurn,
  finishTurnWithContext,
  startAssistantMessage,
  startTurn,
} from "../db/chat-writes.js";
import {
  compactConversationContext,
  compactContextIfNeeded,
  restoreConversationContext,
} from "../llm/context.js";
import {
  createLlmRuntime,
  getTextRuntimeConfig,
  streamWithApiKey,
  type LlmRuntimeConfig,
} from "../llm/runtime.js";
import { getSystemPrompt } from "../db/system-prompts.js";
import { agentTools } from "../tools/index.js";
import { createSseWriter, SSE_HEADERS } from "../utils/sse.js";
import { createSerialQueue } from "../utils/serial-queue.js";
import {
  abortPendingTools,
  finishPendingLlmCalls,
  type ChatCompletionStatus,
} from "../services/chat-persistence.js";
import { createLlmCallTimingTracker } from "../services/llm-call-timing.js";
import {
  createRunningToolRecord,
  finishToolRecord,
  type ToolExecutionRecord,
} from "../services/chat-tool-events.js";
import { resolveThinkingLevel } from "./chat-config.js";
import {
  assistantToolCallIds,
  mergeTransformedContext,
  toolResultDetails,
  toolResultText,
} from "./chat-message.js";
import { buildLlmCompletion } from "../services/chat-llm-completion.js";
import { handleAssistantUpdate, type AssistantUpdate } from "../services/chat-assistant-events.js";

/**
 * 解析并校验聊天请求体。
 * @param body - 客户端请求体
 * @returns 清理后的用户消息和可选会话 ID
 */
export function parseChatRequest(body: {
  conversationId?: string;
  title?: string;
  content?: string;
  modelConfigurationId?: string;
}): {
  conversationId?: string;
  title?: string;
  content: string;
  modelConfigurationId?: string;
} {
  const content = body.content?.trim() ?? "";
  if (!content) throw new Error("content is required");

  if (body.conversationId && !isUuid(body.conversationId)) {
    throw new Error("conversationId is invalid");
  }
  if (body.modelConfigurationId && !isUuid(body.modelConfigurationId)) {
    throw new Error("modelConfigurationId is invalid");
  }

  return {
    conversationId: body.conversationId,
    title: body.title?.trim() || undefined,
    content,
    modelConfigurationId: body.modelConfigurationId,
  };
}

/**
 * 读取已有会话最新的模型上下文快照。
 * 页面消息仅供页面恢复，续聊不读取 messages 或 conversations。
 * @param conversationId - 会话 ID
 * @param model - 当前模型，用于还原快照中的运行字段
 * @returns 可续聊的 Agent 消息数组；会话不存在时返回 null
 */
export async function loadConversationContext(
  conversationId: string,
  model: Model<Api>,
): Promise<AgentMessage[] | null> {
  const snapshot = await getLatestConversationContext(conversationId);
  if (snapshot) return restoreConversationContext(snapshot, model);

  // 旧会话可能没有上下文快照；会话存在时允许从空上下文继续，避免直接报 409。
  return (await conversationExists(conversationId)) ? [] : null;
}

/**
 * 创建聊天路由处理器。
 * @returns Hono handler
 */
export function createChatHandler() {
  return async (c: Context) => {
    // 入口只负责解析本轮请求；历史消息由服务端从数据库加载，客户端不提交完整上下文。
    let body: {
      conversationId?: string;
      title?: string;
      content: string;
      modelConfigurationId?: string;
    };
    try {
      body = parseChatRequest(
        await c.req.json<{
          conversationId?: string;
          title?: string;
          content?: string;
          modelConfigurationId?: string;
        }>(),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid request";
      return c.json({ error: message }, message === "conversationId is invalid" ? 400 : 400);
    }
    const { content } = body;
    let runtimeConfig;
    let models: Models;
    let model: Model<Api>;
    try {
      runtimeConfig = await getTextRuntimeConfig(body.modelConfigurationId);
      ({ models, model } = createLlmRuntime(runtimeConfig));
    } catch (error) {
      const message = error instanceof Error ? error.message : "model configuration is invalid";
      return c.json({ error: message }, 400);
    }
    const systemPrompt = await getSystemPrompt();

    // 新会话在持久化前生成 ID；已有会话沿用原 ID。
    let conversationId = body.conversationId;
    let resumeContext: AgentMessage[] = [];
    let isNewConversation = false;

    if (conversationId) {
      const context = await loadConversationContext(conversationId, model);
      if (!context) {
        return c.json({ error: "conversation context not found" }, 409);
      }
      resumeContext = context;
    } else {
      conversationId = uuidv7();
      isNewConversation = true;
    }

    // 标题只在新会话由首条用户输入生成；续聊优先用客户端回传，绝不按本轮内容重算。
    const title = normalizeConversationTitle(
      body.title ?? (isNewConversation ? titleFromPrompt(content) : ""),
    );

    // 一次请求共用一个 turnId，用于关联本轮产生的消息、LLM 调用和工具调用。
    const userMessageId = uuidv7();
    const assistantMessageId = uuidv7();
    const turnId = uuidv7();
    const llmCallId = uuidv7();
    const thinkingLevel = resolveThinkingLevel(model, runtimeConfig);

    // 先落库用户消息和空助手消息，保证流式过程中断时仍有可恢复的时间线节点。
    await startTurn({
      isNewConversation,
      conversationId,
      turnId,
      title,
      userMessageId,
      assistantMessageId,
      userContent: content,
      model: runtimeConfig.model ?? model.id,
    });

    // SSE 流只负责实时事件；详细工具结果和最终上下文在后台持久化。
    return new Response(
      new ReadableStream({
        async start(controller) {
          const { send, close } = createSseWriter(controller);

          send({
            type: "session",
            conversationId,
            title,
            userMessageId,
            assistantMessageId,
            model: runtimeConfig.model ?? model.id,
          });

          let llmRequestIndex = 0;
          let activeLlmCallId: string | null = null;
          let activeAssistantMessageId = assistantMessageId;
          const llmCallIds = new Set<string>();
          const finishedLlmCallIds = new Set<string>();
          const llmTiming = createLlmCallTimingTracker();
          const assistantMessageByLlmCallId = new Map<string, string>();
          const assistantMessageByToolCallId = new Map<string, string>();
          const agent = new Agent({
            initialState: {
              model,
              systemPrompt,
              messages: [],
              tools: agentTools,
              thinkingLevel,
            },
            transformContext: async (messages, signal) => {
              const transformed = await compactContextIfNeeded(
                messages,
                systemPrompt,
                model,
                models,
                runtimeConfig.apiKey ?? "",
                signal,
              );
              lastTransformedContext = transformed;
              return transformed;
            },
            streamFn: async (activeModel, context, options) => {
              const requestId = llmRequestIndex === 0 ? llmCallId : uuidv7();

              if (llmRequestIndex > 0) {
                activeAssistantMessageId = uuidv7();
                await startAssistantMessage(
                  conversationId,
                  turnId,
                  activeAssistantMessageId,
                  runtimeConfig.model ?? activeModel.id,
                );
                // 后续 LLM 的增量属于新的 assistant 消息，不能混入上一段工具调用响应。
                assistantContent = "";
                assistantThinking = "";
                assistantToolCallsContent = null;
                // 一轮中工具会触发后续 LLM 调用；通知页面创建独立 assistant 节点。
                send({
                  type: "assistant_start",
                  assistantMessageId: activeAssistantMessageId,
                  model: runtimeConfig.model ?? activeModel.id,
                });
              }

              llmRequestIndex += 1;
              activeLlmCallId = requestId;
              llmCallIds.add(requestId);
              const llmStartedAt = llmTiming.start(requestId);
              assistantMessageByLlmCallId.set(requestId, activeAssistantMessageId);

              await startLlmCall({
                llmCallId: requestId,
                conversationId,
                turnId,
                messageId: activeAssistantMessageId,
                provider: activeModel.provider,
                model: activeModel.id,
                thinkingLevel,
                inputContent: JSON.stringify({
                  systemPrompt: context.systemPrompt,
                  messages: context.messages,
                }),
                startedAt: llmStartedAt,
              });

              return streamWithApiKey(models, activeModel, context, options, runtimeConfig);
            },
          });

          agent.state.messages = resumeContext;
          let lastTransformedContext: AgentMessage[] | null = null;

          let assistantContent = "";
          let assistantThinking = "";
          let assistantToolCallsContent: string | null = null;
          const toolStartedAt = new Map<string, number>();
          const toolByCallId = new Map<string, ToolExecutionRecord>();
          const finishedToolIds = new Set<string>();
          const persistQueue = createSerialQueue((error) =>
            console.error("failed to persist tool event", error),
          );

          const unsubscribe = agent.subscribe((event) => {
            // 工具开始时先写入 running 摘要，页面可以立即显示执行状态。
            if (event.type === "tool_execution_start") {
              llmTiming.markFirstToken(activeLlmCallId);
              const startedAt = new Date();
              toolStartedAt.set(event.toolCallId, performance.now());
              const toolCallId = uuidv7();
              const toolMessageId = uuidv7();
              const toolAssistantMessageId =
                assistantMessageByToolCallId.get(event.toolCallId) ?? activeAssistantMessageId;
              const record = createRunningToolRecord(toolCallId, toolMessageId, event.toolName);
              toolByCallId.set(event.toolCallId, record);
              send({
                type: "tool_start",
                id: event.toolCallId,
                name: event.toolName,
                arguments: event.args,
              });
              persistQueue.enqueue(() =>
                startToolCall({
                  toolCallId,
                  conversationId,
                  turnId,
                  assistantMessageId: toolAssistantMessageId,
                  toolMessageId,
                  toolName: event.toolName,
                  args: event.args,
                  startedAt,
                }),
              );
              return;
            }

            // 工具结束时补写状态和耗时；完整输入输出只进入 tool_calls 详情表。
            if (event.type === "tool_execution_end") {
              const started = toolStartedAt.get(event.toolCallId);
              const resultText = toolResultText(event.result);
              const details = toolResultDetails(event.result);
              const errorText = event.isError ? (resultText ?? "tool failed") : null;
              const pending = toolByCallId.get(event.toolCallId);

              if (!pending) {
                throw new Error(`tool_execution_end without start: ${event.toolCallId}`);
              }

              const completed = finishToolRecord(pending, event.isError, errorText, started);
              toolByCallId.set(event.toolCallId, completed);
              finishedToolIds.add(event.toolCallId);

              send({
                type: "tool_end",
                id: event.toolCallId,
                name: event.toolName,
                result: event.isError ? null : resultText,
                details: event.isError ? null : details,
                isError: event.isError,
                error: errorText ?? undefined,
                durationMs: completed.timeline.durationMs,
              });
              persistQueue.enqueue(() =>
                finishToolCall(pending.toolCallId, {
                  status: event.isError ? "error" : "done",
                  resultContent: event.isError ? null : resultText,
                  resultDetails: event.isError ? null : details,
                  errorMessage: errorText,
                  toolMessageId: pending.toolMessageId,
                }),
              );
              return;
            }

            // 每次模型响应结束都记录一条 LLM 调用审计，支持一轮内多次调用。
            if (event.type === "message_end") {
              if (event.message.role !== "assistant" || !activeLlmCallId) return;

              const assistant = event.message as AssistantMessage;
              const requestId = activeLlmCallId;
              const messageId = assistantMessageByLlmCallId.get(requestId);

              if (!messageId) {
                throw new Error(`assistant message is missing for LLM call ${requestId}`);
              }

              if (finishedLlmCallIds.has(requestId)) return;

              finishedLlmCallIds.add(requestId);
              const timing = llmTiming.metrics(requestId, assistant.usage.output);
              const completion = buildLlmCompletion(assistant, model.contextWindow, timing);
              for (const toolCallId of assistantToolCallIds(assistant)) {
                assistantMessageByToolCallId.set(toolCallId, messageId);
              }

              send({ type: "usage", ...completion.usageEvent });

              persistQueue.enqueue(() =>
                finishLlmCall({
                  llmCallId: requestId,
                  ...completion.finish,
                }),
              );

              // toolUse 响应没有正文也必须完成对应 assistant 消息，
              // 原始调用内容保存在 messages.tool_calls_content。
              if (completion.toolCallsContent) {
                assistantToolCallsContent = completion.toolCallsContent;
                persistQueue.enqueue(() =>
                  finishTurn({
                    messageId,
                    content: completion.content,
                    thinking: completion.thinking,
                    toolCallsContent: completion.toolCallsContent,
                    errorMessage: completion.finish.errorMessage,
                  }),
                );
              }
              return;
            }

            if (event.type === "turn_end") return;

            if (event.type !== "message_update") return;

            const update = event.assistantMessageEvent;

            handleAssistantUpdate(update as AssistantUpdate, {
              markFirstToken: () => llmTiming.markFirstToken(activeLlmCallId),
              sendThinking: (delta) => {
                assistantThinking += delta;
                send({ type: "thinking", delta });
              },
              sendText: (delta) => {
                assistantContent += delta;
                send({ type: "delta", delta });
              },
              sendError: (message) => send({ type: "error", message }),
            });
          });

          const abort = () => agent.abort();

          c.req.raw.signal.addEventListener("abort", abort, { once: true });

          let status: ChatCompletionStatus = "done";
          let errorMessage: string | null = null;

          try {
            await agent.prompt(content);

            if (c.req.raw.signal.aborted) {
              status = "aborted";
            } else if (agent.state.errorMessage) {
              status = "error";
              errorMessage = agent.state.errorMessage;
              send({ type: "error", message: agent.state.errorMessage });
            } else {
              send({ type: "done" });
            }
          } catch (error) {
            if (c.req.raw.signal.aborted) {
              status = "aborted";
            } else {
              if (!(error instanceof Error)) throw error;

              status = "error";
              errorMessage = error.message;
              send({ type: "error", message: error.message });
            }
          } finally {
            unsubscribe();
            c.req.raw.signal.removeEventListener("abort", abort);

            // 所有异步持久化按顺序收尾，避免工具开始/结束事件乱序写入。
            try {
              await persistQueue.flush();

              if (status === "aborted") {
                await abortPendingTools(toolByCallId, finishedToolIds);
              }

              await finishPendingLlmCalls(llmCallIds, finishedLlmCallIds, status, errorMessage);

              // 只为完整成功的一轮写入续聊快照，失败请求不会覆盖上一次可用上下文。
              if (status === "done") {
                const persistedMessages = mergeTransformedContext(
                  lastTransformedContext,
                  agent.state.messages,
                );
                await finishTurnWithContext({
                  messageId: activeAssistantMessageId,
                  content: assistantContent,
                  thinking: assistantThinking || null,
                  toolCallsContent: assistantToolCallsContent,
                  errorMessage,
                  conversationId,
                  turnId,
                  context: compactConversationContext(persistedMessages),
                });
              } else {
                await finishTurn({
                  messageId: activeAssistantMessageId,
                  content: assistantContent,
                  thinking: assistantThinking || null,
                  toolCallsContent: assistantToolCallsContent,
                  errorMessage,
                });
              }
            } catch (persistError) {
              console.error("failed to persist assistant turn", persistError);
            }

            close();
          }
        },
      }),
      { headers: SSE_HEADERS },
    );
  };
}
