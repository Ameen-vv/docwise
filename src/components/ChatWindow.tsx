"use client";

import { Bot, Send } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

type ChatWindowProps = {
  documentId: string;
};

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-zinc-200">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc pl-5 space-y-1 leading-relaxed text-zinc-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal pl-5 space-y-1 leading-relaxed text-zinc-200">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-100">{children}</strong>
  ),
  code: ({ children }) => (
    <code className="rounded bg-zinc-700 px-1.5 py-0.5 text-[0.9em] font-medium text-zinc-200">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-sm leading-relaxed text-zinc-200">
      {children}
    </pre>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-base font-semibold text-zinc-100 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-sm font-semibold text-zinc-100 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-zinc-100 first:mt-0">
      {children}
    </h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-zinc-600 pl-3 italic text-zinc-400">
      {children}
    </blockquote>
  ),
};

export function ChatWindow({ documentId }: ChatWindowProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        body: { documentId },
      }),
    [documentId],
  );

  const { messages, sendMessage, status } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setInput("");
    await sendMessage({ text: trimmed });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm font-medium text-zinc-400">
                Ask a question about your document
              </p>
              <p className="max-w-xs text-xs text-zinc-500">
                For example: &ldquo;Summarize the main points&rdquo; or
                &ldquo;What does it say about…?&rdquo;
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user";
              const text = (message.parts ?? [])
                .filter(
                  (part): part is { type: "text"; text: string } =>
                    part.type === "text" &&
                    "text" in part &&
                    typeof part.text === "string",
                )
                .map((part) => part.text)
                .join("");

              return (
                <div
                  key={message.id}
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl text-[15px] ${
                      isUser
                        ? "bg-blue-600 px-4 py-2.5 text-white"
                        : "border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-zinc-200"
                    }`}
                  >
                    {!isUser && (
                      <div className="mb-2.5 flex items-center gap-2 text-zinc-500">
                        <Bot className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                          Assistant
                        </span>
                      </div>
                    )}
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {text}
                      </p>
                    ) : (
                      <div className="min-w-0 text-[15px] leading-[1.6]">
                        <ReactMarkdown components={markdownComponents}>
                          {text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {isLoading && (
            <div className="flex w-full justify-start">
              <div className="max-w-[88%] rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5">
                <div className="mb-2 flex items-center gap-2 text-zinc-500">
                  <Bot className="h-4 w-4" />
                  <span className="text-xs font-medium">Assistant</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-500" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-500 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-500 [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={onSubmit}
          className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 p-3 sm:p-4"
        >
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your document..."
              disabled={isLoading}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none ring-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || input.trim().length === 0}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
