import { NextResponse } from "next/server";
import OpenAI from "openai";
import pdfParse from "pdf-parse";

import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 300;
const EMBEDDING_MODEL = "text-embedding-ada-002";
const EMBEDDING_BATCH_SIZE = 20;

type DocumentInsert = {
  id: string;
};

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) {
    return [];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < normalizedText.length) {
    const endIndex = Math.min(startIndex + chunkSize, normalizedText.length);
    const chunk = normalizedText.slice(startIndex, endIndex).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (endIndex === normalizedText.length) {
      break;
    }

    startIndex += chunkSize - overlap;
  }

  return chunks;
}

export async function POST(request: Request) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Expected form-data field 'file'." },
        { status: 400 },
      );
    }

    if (uploadedFile.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a PDF." },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const parsedPdf = await pdfParse(fileBuffer);
    const chunks = chunkText(parsedPdf.text ?? "", CHUNK_SIZE, CHUNK_OVERLAP);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Could not extract usable text from this PDF." },
        { status: 400 },
      );
    }

    const { data: documentRow, error: documentError } = await supabase
      .from("documents")
      .insert({ name: uploadedFile.name })
      .select("id")
      .single<DocumentInsert>();

    if (documentError || !documentRow) {
      console.error("Document insert failed:", documentError);
      return NextResponse.json(
        { error: "Failed to create document record." },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const rowsToInsert: { document_id: string; content: string; embedding: number[] }[] =
      [];

    for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE);
      const embeddingResponse = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });

      const batchRows = embeddingResponse.data.map((item, batchIndex) => ({
        document_id: documentRow.id,
        content: batch[batchIndex],
        embedding: item.embedding,
      }));

      rowsToInsert.push(...batchRows);
    }

    const { error: chunksError } = await supabase.from("chunks").insert(rowsToInsert);

    if (chunksError) {
      console.error("Chunk insert failed:", chunksError);
      return NextResponse.json(
        { error: "Failed to store embedded chunks." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      documentId: documentRow.id,
      chunks: rowsToInsert.length,
    });
  } catch (error) {
    console.error("Upload pipeline failed:", error);
    return NextResponse.json(
      { error: "Failed to process upload. Please try again." },
      { status: 500 },
    );
  }
}
