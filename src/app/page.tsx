"use client";

import { ChatWindow } from "@/components/ChatWindow";
import { FileUpload } from "@/components/FileUpload";
import { useState } from "react";

export default function Home() {
  const [documentId, setDocumentId] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-8">
      <main className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            DocChat
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Upload a PDF and ask questions about it.
          </p>
        </div>

        <FileUpload onUploadComplete={(id) => setDocumentId(id)} />

        {documentId && (
          <section className="w-full">
            <ChatWindow documentId={documentId} />
          </section>
        )}
      </main>
    </div>
  );
}
