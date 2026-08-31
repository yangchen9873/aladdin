/**
 * @fileoverview 消息列表（用户气泡 + 助手 Markdown）。
 */

import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import { Cpu, Sparkles } from "lucide-react";
import { ICON_STROKE } from "../../lib/constants";
import type { Message } from "../../types/chat";
import { MarkdownContent } from "./MarkdownContent";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";

/** 距底部小于该像素时视为仍贴底 */
const STICK_BOTTOM_PX = 64;

type MessageListProps = {
  /** 当前线程消息 */
  messages: Message[];
  /** 是否正在流式输出最后一条助手消息 */
  streaming: boolean;
};

type MessageItemProps = {
  message: Message;
  streaming: boolean;
  showAvatar: boolean;
};

/**
 * 单条消息：用户靠右气泡，助手带头像 + Markdown。
 * @param props - 消息与流式状态
 */
function MessageItem({ message, streaming, showAvatar }: MessageItemProps) {
  if (message.role === "user") {
    return (
      <article className="flex animate-message-in justify-end">
        <div className="message-user">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
      </article>
    );
  }

  if (message.thinking === undefined) {
    throw new Error(`assistant message ${message.id} missing thinking`);
  }

  const hasAuxiliaryContent = Boolean(message.thinking || message.toolCalls?.length);

  return (
    <article className="flex animate-message-in items-start gap-3">
      {showAvatar ? (
        <span className="message-avatar" aria-hidden>
          <Sparkles size={14} strokeWidth={ICON_STROKE} />
        </span>
      ) : (
        <span className="size-7 shrink-0" aria-hidden />
      )}

      <div className="min-w-0 flex-1 pt-3 text-base leading-normal">
        {message.model ? (
          <div
            className="mb-2 flex max-w-full items-center gap-1 text-xs text-fg-tertiary"
            title={message.model}
          >
            <Cpu size={12} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="truncate">{message.model}</span>
          </div>
        ) : null}
        <ThinkingBlock
          thinking={message.thinking}
          active={
            streaming &&
            message.content.length === 0 &&
            !message.error &&
            !message.toolCalls?.length
          }
        />
        {message.toolCalls?.map((call) => (
          <ToolCallBlock key={call.id} call={call} />
        ))}
        {message.content ? (
          <div className={hasAuxiliaryContent ? "mt-3" : undefined}>
            <MarkdownContent content={message.content} />
          </div>
        ) : null}
        {message.error ? <p className="mt-2 text-sm text-destructive">{message.error}</p> : null}
      </div>
    </article>
  );
}

/** 同一 turn 中后续 LLM 调用的轻量边界。 */
function LlmCallDivider() {
  return (
    <div className="ml-10 mr-4 flex py-0.5" aria-label="下一次 LLM 调用开始">
      <span className="flex-1 border-t border-dashed border-border-subtle/70" />
    </div>
  );
}

/** 会话轮次之间的撕开虚线。 */
function TurnTear() {
  return <div className="turn-tear" role="separator" aria-label="上一轮对话结束" />;
}

/** 按用户发言切分会话轮次。 */
function groupByTurn(messages: Message[]): Message[][] {
  const turns: Message[][] = [];

  for (const message of messages) {
    if (message.role === "user" || turns.length === 0) {
      turns.push([message]);
      continue;
    }

    turns[turns.length - 1].push(message);
  }

  return turns;
}

/**
 * 可滚动的消息线程。流式输出时贴底滚动；用户上滑后停止。
 * @param props - 消息列表与流式标记
 * @returns 组件 JSX
 */
export function MessageList({ messages, streaming }: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lastMessageId = messages.at(-1)?.id;

  useLayoutEffect(() => {
    stickToBottomRef.current = true;
  }, [messages.length, lastMessageId]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;

    if (!scroller || !content) return;

    const scrollToBottom = () => {
      if (!stickToBottomRef.current) return;

      scroller.scrollTop = scroller.scrollHeight;
    };

    const onScroll = () => {
      const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      stickToBottomRef.current = gap <= STICK_BOTTOM_PX;
    };

    // 展开 Thought / Tool 时不自动贴底，否则标题会被滚动推离鼠标位置。
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Element && target.closest("button")) {
        stickToBottomRef.current = false;
      }
    };

    const observer = new ResizeObserver(scrollToBottom);

    observer.observe(content);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("pointerdown", onPointerDown);
    scrollToBottom();

    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <div ref={scrollerRef} className="flex-1 overflow-y-auto">
      <div ref={contentRef} className="thread-column py-6 pb-32">
        {groupByTurn(messages).map((turn, turnIndex) => (
          <Fragment key={turn[0].id}>
            {turnIndex > 0 ? <TurnTear /> : null}
            <div className="flex flex-col gap-2">
              {turn.map((message, indexInTurn) => {
                const isFollowupLlm =
                  message.role === "assistant" && turn[indexInTurn - 1]?.role === "assistant";
                const item = (
                  <MessageItem
                    message={message}
                    streaming={
                      streaming &&
                      message.id === messages.at(-1)?.id &&
                      message.role === "assistant"
                    }
                    showAvatar={message.role === "assistant" && !isFollowupLlm}
                  />
                );

                if (message.role !== "assistant") return <div key={message.id}>{item}</div>;

                return (
                  <div key={message.id} className="space-y-1">
                    {isFollowupLlm ? <LlmCallDivider /> : null}
                    {item}
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
