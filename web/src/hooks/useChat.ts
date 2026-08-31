/**
 * @fileoverview 聊天会话状态与发送流式回复逻辑。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { v7 as uuidv7 } from "uuid";
import { streamChat } from "../api/chat";
import { deleteConversation, getConversation, listConversations } from "../api/conversations";
import { createMessage, patchMessage, titleFromPrompt, toChatGroups } from "../lib/chat";
import type { Conversation, TokenUsage } from "../types/chat";
import { createChatStreamHandlers } from "./chat-stream-handlers";
import { mergeConversationSummaries } from "./conversation-state";

/** 刷新图标最短展示时间，避免快速响应时看不到动画 */
const MIN_REFRESH_DURATION_MS = 400;

const EMPTY_TOKEN_USAGE: TokenUsage = {
  total: 0,
  input: 0,
  output: 0,
  cache: 0,
  cacheRatio: 0,
  contextRatio: 0,
};

/**
 * 管理对话列表、当前会话与流式发送。
 * @returns 页面所需的会话状态与操作方法
 */
export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextConversationCursor, setNextConversationCursor] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>(EMPTY_TOKEN_USAGE);
  const abortRef = useRef<AbortController | null>(null);
  const selectGenRef = useRef(0);
  const chatIdRef = useRef<string | null>(null);
  const userMessageIdRef = useRef<string | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);

  const activeChat = conversations.find((chat) => chat.id === activeChatId);
  const messages = activeChat ? activeChat.messages : [];
  const showThread = activeChatId !== null;
  const chatGroups = toChatGroups(conversations);

  /**
   * 刷新会话摘要列表，并保留尚未同步完成的本地乐观会话。
   * @returns 刷新完成后结束
   */
  const refreshConversations = useCallback(async () => {
    const startedAt = Date.now();

    setRefreshing(true);

    try {
      // 先拉取服务端摘要，消息正文按需加载，避免刷新侧栏时传输大字段。
      const page = await listConversations();

      setConversations((current) => mergeConversationSummaries(current, page.conversations));
      setNextConversationCursor(page.nextCursor);
    } finally {
      const remaining = MIN_REFRESH_DURATION_MS - (Date.now() - startedAt);

      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }

      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshConversations().catch((error: unknown) => {
      console.error("failed to load conversations", error);
    });
  }, [refreshConversations]);

  /** 读取下一页会话摘要；无下一页或已有请求时不重复发起。 */
  const loadMoreConversations = useCallback(async () => {
    if (!nextConversationCursor || loadingMore || refreshing) return;

    setLoadingMore(true);

    try {
      const page = await listConversations(nextConversationCursor);

      setConversations((current) => mergeConversationSummaries(current, page.conversations));
      setNextConversationCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextConversationCursor, refreshing]);

  /**
   * 中止当前进行中的流式请求并清理控制器引用。
   * @returns 无返回值
   */
  const abortStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  /**
   * 插入或更新指定会话，并把该会话移到列表顶部。
   * @param chatId - 会话 ID
   * @param updater - 已存在时的更新函数
   * @param create - 不存在时的创建函数
   */
  const upsertConversation = useCallback(
    (chatId: string, updater: (chat: Conversation) => Conversation, create: () => Conversation) => {
      setConversations((current) => {
        const index = current.findIndex((chat) => chat.id === chatId);

        if (index === -1) return [create(), ...current];

        const existing = current[index];

        if (!existing) {
          throw new Error(`conversation ${chatId} missing during update`);
        }

        const next = updater(existing);

        return [next, ...current.filter((_, i) => i !== index)];
      });
    },
    [],
  );

  /**
   * 发送用户消息并流式追加助手回复。
   * @param text - 用户输入
   * @param modelConfigurationId - 可选的文本模型配置 ID
   * @returns 流式请求完成后结束；空输入或已有请求时直接返回
   */
  const send = useCallback(
    async (text: string, modelConfigurationId?: string) => {
      const prompt = text.trim();

      if (!prompt || streaming) return;

      abortStreaming();

      const controller = new AbortController();
      abortRef.current = controller;

      const isExisting = activeChatId !== null;
      const chatId = isExisting ? activeChatId : uuidv7();
      const userMessage = createMessage("user", prompt);
      const assistantMessage = createMessage("assistant", "", "");
      const history = activeChat ? activeChat.messages : [];
      const nextMessages = [...history, userMessage];

      chatIdRef.current = chatId;
      userMessageIdRef.current = userMessage.id;
      assistantMessageIdRef.current = assistantMessage.id;

      upsertConversation(
        chatId,
        (chat) => ({ ...chat, messages: [...nextMessages, assistantMessage] }),
        () => ({
          id: chatId,
          title: titleFromPrompt(prompt),
          createdAt: Date.now(),
          messages: [...nextMessages, assistantMessage],
        }),
      );

      setActiveChatId(chatId);
      setDraft("");
      setStreaming(true);

      try {
        await streamChat({
          conversationId: isExisting ? chatId : undefined,
          ...(isExisting ? {} : { title: titleFromPrompt(prompt) }),
          content: prompt,
          modelConfigurationId,
          signal: controller.signal,
          ...createChatStreamHandlers({
            setConversations,
            setActiveChatId,
            setTokenUsage,
            chatIdRef,
            userMessageIdRef,
            assistantMessageIdRef,
          }),
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        if (!(error instanceof Error)) throw error;

        const targetChatId = chatIdRef.current;
        const targetAssistantId = assistantMessageIdRef.current;

        if (!targetChatId || !targetAssistantId) return;

        setConversations((current) =>
          patchMessage(current, targetChatId, targetAssistantId, {
            error: error.message,
          }),
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;

        setStreaming(false);
      }
    },
    [abortStreaming, activeChat, activeChatId, streaming, upsertConversation],
  );

  /** 清空当前线程，进入新对话 */
  const newChat = useCallback(() => {
    abortStreaming();
    selectGenRef.current += 1;
    setActiveChatId(null);
    setDraft("");
    setTokenUsage(EMPTY_TOKEN_USAGE);
  }, [abortStreaming]);

  /**
   * 加载会话详情并应用消息与 token 用量。
   * @param id - 会话 ID
   * @param generation - 当前选择序号，用于忽略过期响应
   */
  const loadConversation = useCallback((id: string, generation: number) => {
    void getConversation(id)
      .then((detail) => {
        if (generation !== selectGenRef.current) return;

        setConversations((current) =>
          current.map((chat) => (chat.id === id ? { ...chat, messages: detail.messages } : chat)),
        );
        setTokenUsage(detail.usage);
      })
      .catch((error: unknown) => {
        if (generation !== selectGenRef.current) return;

        console.error("failed to load conversation", error);
      });
  }, []);

  /**
   * 切换到已有对话并拉取消息。
   * @param id - 目标会话 ID
   */
  const selectChat = useCallback(
    (id: string) => {
      if (id === activeChatId) return;

      abortStreaming();
      const gen = ++selectGenRef.current;

      setActiveChatId(id);
      setDraft("");
      setTokenUsage(EMPTY_TOKEN_USAGE);

      loadConversation(id, gen);
    },
    [abortStreaming, activeChatId, loadConversation],
  );

  /**
   * 删除对话；若删的是当前会话则切换到剩余第一条。
   * @param chatId - 要删除的会话 ID
   */
  const deleteChat = useCallback(
    (chatId: string) => {
      const switchingAway = chatId === activeChatId;

      if (switchingAway) abortStreaming();

      void deleteConversation(chatId)
        .then(() => {
          const remaining = conversations.filter((chat) => chat.id !== chatId);

          setConversations(remaining);

          if (!switchingAway) return;

          const nextId = remaining[0]?.id ?? null;

          setActiveChatId(nextId);
          setDraft("");
          setTokenUsage(EMPTY_TOKEN_USAGE);

          if (!nextId) return;

          const gen = ++selectGenRef.current;

          loadConversation(nextId, gen);
        })
        .catch((error: unknown) => {
          console.error("failed to delete conversation", error);
        });
    },
    [abortStreaming, activeChatId, conversations, loadConversation],
  );

  return {
    chatGroups,
    refreshing,
    loadingMore,
    hasMoreConversations: nextConversationCursor !== null,
    refreshConversations,
    loadMoreConversations,
    activeChatId,
    messages,
    showThread,
    draft,
    setDraft,
    streaming,
    tokenUsage,
    send,
    stop: abortStreaming,
    newChat,
    selectChat,
    deleteChat,
  };
}
