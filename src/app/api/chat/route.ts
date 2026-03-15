import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSION = 1536;
const MATCH_COUNT = 50;
const TOP_K = 5;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

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
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY environment variable." },
        { status: 500 },
      );
    }

    if (!groqApiKey) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY environment variable." },
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

    const chatMessages = body.messages
      .filter(
        (message): message is ChatMessage & { role: "user" | "assistant" } =>
          message.role === "user" || message.role === "assistant",
      )
      .map((message) => ({
        role: message.role,
        content: getMessageText(message.content),
      }))
      .filter((message) => message.content.length > 0);

    if (chatMessages.length === 0) {
      return NextResponse.json(
        { error: "No valid chat messages to send to Groq." },
        { status: 400 },
      );
    }

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        stream: true,
        temperature: 0.2,
        messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return NextResponse.json(
        {
          error: `Groq API error (${groqResponse.status}): ${errorText}`,
        },
        { status: groqResponse.status },
      );
    }

    if (!groqResponse.body) {
      return NextResponse.json(
        { error: "Groq response did not include a stream body." },
        { status: 500 },
      );
    }
    const groqBody = groqResponse.body;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendTextDelta = (delta: string) => {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(delta)}\n`));
        };

        try {
          const reader = groqBody.getReader();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith("data:")) {
                continue;
              }

              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") {
                continue;
              }

              try {
                const parsed = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const textDelta = parsed.choices?.[0]?.delta?.content ?? "";
                if (textDelta.length > 0) {
                  sendTextDelta(textDelta);
                }
              } catch {
                // Ignore malformed partial chunks and keep streaming.
              }
            }
          }

          controller.close();
        } catch (streamError) {
          console.error("Groq stream failed:", streamError);
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
