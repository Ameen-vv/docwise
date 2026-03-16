"use client";

import { ChatWindow } from "@/components/ChatWindow";
import { FileUpload } from "@/components/FileUpload";
import { FileText, Upload } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);

  const handleUploadComplete = (id: string, fileName: string) => {
    setDocumentId(id);
    setDocumentName(fileName);
  };

  const handleUploadOther = () => {
    setDocumentId(null);
    setDocumentName(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              DocWise
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
              Chat with your PDFs
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Upload a document, then ask natural language questions about its
              contents.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
        {!documentId ? (
          <section className="rounded-2xl border border-dashed border-zinc-200 bg-white/80 p-4 shadow-sm sm:p-6">
            <h2 className="text-sm font-semibold text-zinc-800">
              Upload a PDF
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              We&apos;ll parse and index your file so you can ask questions
              about it.
            </p>
            <div className="mt-4">
              <FileUpload onUploadComplete={handleUploadComplete} />
            </div>
          </section>
        ) : (
          <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <FileText className="h-5 w-5 text-zinc-600" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {documentName ?? "Document"}
                </p>
                <p className="text-xs text-zinc-500">Ready to chat</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUploadOther}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <Upload className="h-4 w-4" />
              Upload other doc
            </button>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-800">
                Ask questions
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {documentId
                  ? "Chat about your document below."
                  : "Upload a PDF above to start."}
              </p>
            </div>
          </div>

          {documentId ? (
            <ChatWindow key={documentId} documentId={documentId} />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
              Upload a PDF to start chatting about it.
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 text-xs text-zinc-500">
          <span>Built with Next.js, Groq, Gemini & Supabase.</span>
        </div>
      </footer>
    </div>
  );
}
