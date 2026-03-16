import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSION = 1536;
const MATCH_COUNT = 50;
const TOP_K = 5;
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content?: string | Array<{ type?: string; text?: string }>;
  parts?: Array<{ type?: string; text?: string }>;
};

type MatchChunkRow = {
  id: string;
  content: string;
  similarity: number;
};

function getMessageText(
  content: ChatMessage['content'],
  parts?: ChatMessage['parts'],
): string {
  if (typeof content === 'string') {
    return content;
  }

  const sourceParts = Array.isArray(content)
    ? content
    : Array.isArray(parts)
      ? parts
      : [];

  return sourceParts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
}

function buildSystemPrompt(contextChunks: string[]): string {
  const context = contextChunks.length
    ? contextChunks
        .map((chunk, index) => `[${index + 1}] ${chunk}`)
        .join('\n\n')
    : 'No relevant context retrieved from the document.';

  return [
    "You are a helpful document assistant. You answer questions using only the provided context from the user's uploaded document. Be warm and direct.",
    '',
    'Guidelines:',
    '- Answer the question directly. If the context supports an answer (e.g., skills, experience, facts), give a clear answer and briefly point to the relevant parts. Do not refuse to answer when the context clearly contains relevant information.',
    '- For subjective questions (e.g., "Is this candidate good at X?"), infer from the document: summarize relevant skills/experience and give a clear yes/no or assessment with one short sentence of reasoning. Avoid phrases like "I cannot assess" or "it\'s difficult to determine" when the document lists relevant skills or experience.',
    '- Keep replies concise and friendly. Do not repeat long disclaimers or sound robotic. One short caveat like "Based on the document" is enough when needed.',
    '- If the answer truly is not in the context, say so in one sentence and suggest what kind of information would be needed.',
    '',
    'Retrieved context:',
    context,
  ].join('\n');
}

export async function POST(request: Request) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY environment variable.' },
        { status: 500 },
      );
    }

    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'Missing GROQ_API_KEY environment variable.' },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      messages?: ChatMessage[];
      documentId?: string;
    };

    if (!Array.isArray(body.messages) || !body.documentId) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { messages, documentId }.' },
        { status: 400 },
      );
    }

    const lastUserMessage = [...body.messages]
      .reverse()
      .find(
        (message) =>
          message.role === 'user' &&
          getMessageText(message.content, message.parts).length > 0,
      );

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: 'No user message found to embed.' },
        { status: 400 },
      );
    }

    const lastUserText = getMessageText(
      lastUserMessage.content,
      lastUserMessage.parts,
    );
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
        { error: 'Failed to generate query embedding.' },
        { status: 500 },
      );
    }

    const { data: matches, error: matchError } = await supabase.rpc(
      'match_chunks',
      {
        match_count: MATCH_COUNT,
        query_embedding: queryEmbedding,
        filter_document_id: body.documentId,
      },
    );

    if (matchError) {
      console.error('match_chunks RPC failed:', matchError);
      return NextResponse.json(
        { error: 'Failed to retrieve relevant chunks.' },
        { status: 500 },
      );
    }

    const relevantMatches = ((matches ?? []) as MatchChunkRow[]).filter(
      (row) => typeof row.id === 'string' && typeof row.content === 'string',
    );

    const topMatches = relevantMatches.slice(0, TOP_K);
    const systemPrompt = buildSystemPrompt(
      topMatches.map((row) => row.content),
    );

    const chatMessages = body.messages
      .filter(
        (message): message is ChatMessage & { role: 'user' | 'assistant' } =>
          message.role === 'user' || message.role === 'assistant',
      )
      .map((message) => ({
        role: message.role,
        content: getMessageText(message.content, message.parts),
      }))
      .filter((message) => message.content.length > 0);

    if (chatMessages.length === 0) {
      return NextResponse.json(
        { error: 'No valid chat messages to send to Groq.' },
        { status: 400 },
      );
    }

    const groq = new Groq({ apiKey: groqApiKey });
    const groqStream = await groq.chat.completions.create({
      model: groqModel,
      stream: true,
      temperature: 0.2,
      messages: [{ role: 'system', content: systemPrompt }, ...chatMessages],
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendTextDelta = (delta: string) => {
          controller.enqueue(encoder.encode(delta));
        };

        try {
          for await (const chunk of groqStream) {
            const textDelta = chunk.choices?.[0]?.delta?.content ?? '';
            if (textDelta.length > 0) {
              sendTextDelta(textDelta);
            }
          }
          controller.close();
        } catch (streamError) {
          console.error('Groq stream failed:', streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error) {
    console.error('Chat route failed:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request.' },
      { status: 500 },
    );
  }
}
