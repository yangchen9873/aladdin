/**
 * @fileoverview 聊天 SSE 事件到本地会话状态的适配器。
 */

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ChatSseEvent } from "../api/chat";
import { patchMessage, remapSessionIds } from "../lib/chat";
import type { Conversation, TokenUsage } from "../types/chat";

type UsageEvent = Pick<TokenUsage, "total" | "input" | "output" | "cache" | "contextRatio">;

type HandlerContext = {
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setActiveChatId: Dispatch<SetStateAction<string | null>>;
  setTokenUsage: Dispatch<SetStateAction<TokenUsage>>;
  chatIdRef: RefObject<string | null>;
  userMessageIdRef: RefObject<string | null>;
  assistantMessageIdRef: RefObject<string | null>;
};

/**
 * 累加本轮 token 用量并重新计算缓存比例。
 * @param current - 当前累计用量
 * @param usage - SSE 推送的本次调用用量
 * @returns 更新后的累计用量
 */
function addTokenUsage(current: TokenUsage, usage: UsageEvent): TokenUsage {
  const input = current.input + usage.input;
  const cache = current.cache + usage.cache;
  const output = current.output + usage.output;
  const total = current.total + usage.total;
  const denominator = input + cache;

  return {
    total,
    input,
    output,
    cache,
    cacheRatio: denominator > 0 ? cache / denominator : 0,
    contextRatio: usage.contextRatio,
  };
}

/**
 * 创建一组只负责更新聊天状态的 SSE 回调。
 * @param context - 会话状态更新所需的 setter 与 ref
 * @returns SSE 事件处理器集合
 */
export function createChatStreamHandlers(context: HandlerContext) {
  const {
    setConversations,
    setActiveChatId,
    setTokenUsage,
    chatIdRef,
    userMessageIdRef,
    assistantMessageIdRef,
  } = context;

  return {
    /** 接收会话映射并更新本地消息 ID。 */
    onSession: (session: Omit<Extract<ChatSseEvent, { type: "session" }>, "type">) => {
      const fromChatId = chatIdRef.current;
      const fromUserId = userMessageIdRef.current;
      const fromAssistantId = assistantMessageIdRef.current;
      if (!fromChatId || !fromUserId || !fromAssistantId)
        throw new Error("session arrived before local message ids were set");

      chatIdRef.current = session.conversationId;
      userMessageIdRef.current = session.userMessageId;
      assistantMessageIdRef.current = session.assistantMessageId;
      setActiveChatId(session.conversationId);
      setConversations((current) =>
        remapSessionIds(
          current,
          {
            chatId: fromChatId,
            userMessageId: fromUserId,
            assistantMessageId: fromAssistantId,
          },
          {
            chatId: session.conversationId,
            title: session.title,
            userMessageId: session.userMessageId,
            assistantMessageId: session.assistantMessageId,
          },
        ),
      );
      setConversations((current) =>
        patchMessage(current, session.conversationId, session.assistantMessageId, {
          model: session.model,
        }),
      );
    },
    /** 将助手正文增量追加到当前消息。 */
    onDelta: (delta: string) => {
      const chatId = chatIdRef.current;
      const messageId = assistantMessageIdRef.current;
      if (!chatId || !messageId) return;
      setConversations((current) =>
        patchMessage(current, chatId, messageId, (message) => ({
          content: message.content + delta,
        })),
      );
    },
    /** 将思考过程增量追加到当前消息。 */
    onThinking: (delta: string) => {
      const chatId = chatIdRef.current;
      const messageId = assistantMessageIdRef.current;
      if (!chatId || !messageId) return;
      setConversations((current) =>
        patchMessage(current, chatId, messageId, (message) => ({
          thinking: (message.thinking ?? "") + delta,
        })),
      );
    },
    /** 创建后续助手消息对应的本地时间线节点。 */
    onAssistantStart: (assistantMessageId: string, model: string) => {
      const chatId = chatIdRef.current;
      if (!chatId) return;
      assistantMessageIdRef.current = assistantMessageId;
      setConversations((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    id: assistantMessageId,
                    role: "assistant",
                    model,
                    content: "",
                    thinking: "",
                    toolCalls: [],
                  },
                ],
              }
            : chat,
        ),
      );
    },
    /** 将工具调用加入当前助手消息。 */
    onToolStart: (call: Omit<Extract<ChatSseEvent, { type: "tool_start" }>, "type">) => {
      const chatId = chatIdRef.current;
      const messageId = assistantMessageIdRef.current;
      if (!chatId || !messageId) return;
      setConversations((current) =>
        patchMessage(current, chatId, messageId, (message) => ({
          toolCalls: [
            ...(message.toolCalls ?? []),
            {
              id: call.id,
              name: call.name,
              arguments: call.arguments,
              status: "running",
            },
          ],
        })),
      );
    },
    /** 更新工具调用结果、状态和耗时。 */
    onToolEnd: (call: Omit<Extract<ChatSseEvent, { type: "tool_end" }>, "type">) => {
      const chatId = chatIdRef.current;
      const messageId = assistantMessageIdRef.current;
      if (!chatId || !messageId) return;
      setConversations((current) =>
        patchMessage(current, chatId, messageId, (message) => ({
          toolCalls: (message.toolCalls ?? []).map((item) =>
            item.id === call.id
              ? {
                  ...item,
                  result: call.result,
                  details: call.details,
                  status: call.isError ? "error" : "done",
                  error: call.error,
                  durationMs: call.durationMs,
                }
              : item,
          ),
        })),
      );
    },
    /** 累加服务端推送的 token 用量。 */
    onUsage: (usage: UsageEvent) => setTokenUsage((current) => addTokenUsage(current, usage)),
  };
}
