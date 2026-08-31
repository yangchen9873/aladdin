/**
 * @fileoverview 根布局：侧栏 + 主聊天区。
 */

import { useCallback, useEffect, useState } from "react";
import { Composer } from "./components/chat/Composer";
import { EmptyState } from "./components/chat/EmptyState";
import { MessageList } from "./components/chat/MessageList";
import { DatabaseInspectorModal } from "./components/layout/DatabaseInspectorModal";
import { ChatHeader } from "./components/layout/ChatHeader";
import { SystemPromptModal } from "./components/layout/SystemPromptModal";
import { ModelConfigurationModal } from "./components/layout/ModelConfigurationModal";
import { Sidebar } from "./components/layout/Sidebar";
import { useChat } from "./hooks/useChat";
import { useTheme } from "./hooks/useTheme";
import { WELCOME_PROMPT } from "./lib/constants";
import { getTextModelConfiguration, type TextModelConfiguration } from "./api/model-configuration";

/**
 * 应用根组件。
 * @returns 组件 JSX
 */
export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [composerFocusKey, setComposerFocusKey] = useState(0);
  const [databaseInspectorOpen, setDatabaseInspectorOpen] = useState(false);
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [modelConfigurationOpen, setModelConfigurationOpen] = useState(false);
  const [modelConfigurations, setModelConfigurations] = useState<TextModelConfiguration[]>([]);
  const [selectedModelConfigurationId, setSelectedModelConfigurationId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const chat = useChat();

  /**
   * 从服务端刷新模型配置，并尽量保留当前选择。
   * @returns 无返回值；错误通过控制台记录
   */
  const refreshModelConfigurations = useCallback(() => {
    void getTextModelConfiguration()
      .then((data) => {
        setModelConfigurations(data.configurations);
        setSelectedModelConfigurationId((current) =>
          data.configurations.some((item) => item.id === current)
            ? current
            : (data.configurations.find((item) => item.isActive === "1")?.id ?? null),
        );
      })
      .catch((error: unknown) => console.error("failed to load model configurations", error));
  }, []);

  useEffect(() => {
    refreshModelConfigurations();
  }, [refreshModelConfigurations]);

  // 提示信息仅在触发后的短时间内展示，避免占用聊天界面。
  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /** 关闭编辑器并展示一次保存成功反馈。 */
  const handleSystemPromptSaved = () => {
    setSystemPromptOpen(false);
    setNotice("系统提示词已保存");
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        activeChatId={chat.activeChatId}
        chatGroups={chat.chatGroups}
        onSelectChat={chat.selectChat}
        onNewChat={() => {
          chat.newChat();
          setComposerFocusKey((key) => key + 1);
        }}
        onRefreshChats={() => {
          void chat.refreshConversations().catch((error: unknown) => {
            console.error("failed to refresh conversations", error);
          });
        }}
        refreshingChats={chat.refreshing}
        hasMoreChats={chat.hasMoreConversations}
        loadingMoreChats={chat.loadingMore}
        onLoadMoreChats={() => {
          void chat.loadMoreConversations().catch((error: unknown) => {
            console.error("failed to load more conversations", error);
          });
        }}
        onDeleteChat={chat.deleteChat}
      />

      {!sidebarCollapsed && (
        <button
          type="button"
          className="fixed inset-0 z-30 border-0 bg-overlay md:hidden"
          aria-label="关闭侧边栏"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <main className="relative flex h-full min-w-0 flex-1 flex-col bg-surface">
        <ChatHeader
          theme={theme}
          showMenuButton={sidebarCollapsed}
          onOpenSidebar={() => setSidebarCollapsed(false)}
          onToggleTheme={toggleTheme}
          onOpenDatabase={() => setDatabaseInspectorOpen(true)}
          onOpenPromptMaintenance={() => setSystemPromptOpen(true)}
          onOpenModelConfiguration={() => setModelConfigurationOpen(true)}
          modelConfigurations={modelConfigurations.filter(
            (item): item is TextModelConfiguration & { id: string } => Boolean(item.id),
          )}
          modelConfigurationId={selectedModelConfigurationId}
          onModelConfigurationChange={setSelectedModelConfigurationId}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          {chat.showThread ? (
            <MessageList messages={chat.messages} streaming={chat.streaming} />
          ) : (
            <EmptyState />
          )}

          <Composer
            value={chat.draft}
            onChange={chat.setDraft}
            onSend={(text) => void chat.send(text, selectedModelConfigurationId ?? undefined)}
            onStop={chat.stop}
            streaming={chat.streaming}
            placeholder={WELCOME_PROMPT}
            focusKey={composerFocusKey}
            tokenUsage={chat.tokenUsage}
          />
        </div>
      </main>

      <DatabaseInspectorModal
        open={databaseInspectorOpen}
        onClose={() => setDatabaseInspectorOpen(false)}
      />
      {systemPromptOpen ? (
        <SystemPromptModal
          onClose={() => setSystemPromptOpen(false)}
          onSaved={handleSystemPromptSaved}
        />
      ) : null}
      {modelConfigurationOpen ? (
        <ModelConfigurationModal
          onClose={() => setModelConfigurationOpen(false)}
          onSaved={() => {
            refreshModelConfigurations();
            setNotice("模型配置已保存");
          }}
        />
      ) : null}
      {notice ? (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[90] rounded-lg bg-fg px-4 py-2.5 text-sm font-medium text-fg-inverse shadow-md"
        >
          {notice}
        </div>
      ) : null}
    </div>
  );
}
