import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSION = 1536;
const MATCH_COUNT = 50;
const TOP_K = 5;
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type?: string; text?: string }>;
};

type MatchChunkRow = {
  id: string;
  content: string;
  similarity: number;
};

function getMessageText(content: ChatMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function buildSystemPrompt(contextChunks: string[]): string {
  const context = contextChunks.length
    ? contextChunks.map((chunk, index) => `[${index + 1}] ${chunk}`).join("\n\n")
    : "No relevant context retrieved from the document.";

  return [
    "You are DocChat, an assistant answering questions about an uploaded document.",
    "Use only the provided context when possible. If the answer is not present, clearly say you don't know based on the document.",
    "Keep answers concise, factual, and directly tied to the context.",
    "",
    "Retrieved context:",
    context,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: "Missing ANTHROPIC_API_KEY environment variable." },
        { status: 500 },
      );
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      messages?: ChatMessage[];
      documentId?: string;
    };

    if (!Array.isArray(body.messages) || !body.documentId) {
      return NextResponse.json(
        { error: "Invalid request body. Expected { messages, documentId }." },
        { status: 400 },
      );
    }

    const lastUserMessage = [...body.messages]
      .reverse()
      .find((message) => message.role === "user" && getMessageText(message.content).length > 0);

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "No user message found to embed." },
        { status: 400 },
      );
    }

    const lastUserText = getMessageText(lastUserMessage.content);
    const gemini = new GoogleGenAI({ apiKey: geminiApiKey });
    const embeddingResponse = await gemini.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: lastUserText,
      config: {
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    });

    const queryEmbedding = embeddingResponse.embeddings?.[0]?.values;
    if (!queryEmbedding || queryEmbedding.length !== EMBEDDING_DIMENSION) {
      return NextResponse.json(
        { error: "Failed to generate query embedding." },
        { status: 500 },
      );
    }

    const { data: matches, error: matchError } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
    });

    if (matchError) {
      console.error("match_chunks RPC failed:", matchError);
      return NextResponse.json(
        { error: "Failed to retrieve relevant chunks." },
        { status: 500 },
      );
    }

    const allMatches = ((matches ?? []) as MatchChunkRow[]).filter(
      (row) => typeof row.id === "string" && typeof row.content === "string",
    );

    let relevantMatches: MatchChunkRow[] = allMatches;
    if (allMatches.length > 0) {
      const { data: chunkRows, error: chunkFilterError } = await supabase
        .from("chunks")
        .select("id")
        .eq("document_id", body.documentId)
        .in(
          "id",
          allMatches.map((row) => row.id),
        );

      if (chunkFilterError) {
        console.error("Chunk document filter failed:", chunkFilterError);
        return NextResponse.json(
          { error: "Failed to filter chunks for the selected document." },
          { status: 500 },
        );
      }

      const allowedChunkIds = new Set((chunkRows ?? []).map((row) => row.id as string));
      relevantMatches = allMatches.filter((row) => allowedChunkIds.has(row.id));
    }

    const topMatches = relevantMatches.slice(0, TOP_K);
    const systemPrompt = buildSystemPrompt(topMatches.map((row) => row.content));

    const anthropicMessages = body.messages
      .filter(
        (message): message is ChatMessage & { role: "user" | "assistant" } =>
          message.role === "user" || message.role === "assistant",
      )
      .map((message) => ({
        role: message.role,
        content: getMessageText(message.content),
      }))
      .filter((message) => message.content.length > 0);

    if (anthropicMessages.length === 0) {
      return NextResponse.json(
        { error: "No valid chat messages to send to Claude." },
        { status: 400 },
      );
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const claudeStream = anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendTextDelta = (delta: string) => {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(delta)}\n`));
        };

        claudeStream.on("text", (textDelta) => {
          sendTextDelta(textDelta);
        });

        try {
          await claudeStream.done();
          controller.close();
        } catch (streamError) {
          console.error("Claude stream failed:", streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "x-vercel-ai-data-stream": "v1",
      },
    });
  } catch (error) {
    console.error("Chat route failed:", error);
    return NextResponse.json({ error: "Failed to process chat request." }, { status: 500 });
  }
}
