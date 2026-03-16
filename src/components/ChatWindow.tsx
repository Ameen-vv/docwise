"use client";

import { Bot, Send } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type ChatWindowProps = {
  documentId: string;
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
    <div className="w-full rounded-xl border border-zinc-200 bg-white">
      <div className="h-[450px] space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Ask a question about your uploaded document.
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";
            const text = (message.parts ?? [])
              .filter(
                (part): part is { type: "text"; text: string } =>
                  part.type === "text" && "text" in part && typeof part.text === "string",
              )
              .map((part) => part.text)
              .join("");

            return (
              <div
                key={message.id}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    isUser
                      ? "bg-blue-600 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-900"
                  }`}
                >
                  {!isUser && (
                    <div className="mb-2 flex items-center gap-2 text-zinc-600">
                      <Bot className="h-4 w-4" />
                      <span className="text-xs font-medium">Assistant</span>
                    </div>
                  )}
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-zinc">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="max-w-[85%] rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-900">
              <div className="mb-2 flex items-center gap-2 text-zinc-600">
                <Bot className="h-4 w-4" />
                <span className="text-xs font-medium">Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:240ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-zinc-200 p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your document..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100"
          />
          <button
            type="submit"
            disabled={isLoading || input.trim().length === 0}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
