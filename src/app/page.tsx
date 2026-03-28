'use client';

import { ChatWindow } from '@/components/ChatWindow';
import { DocwiseIcon } from '@/components/DocwiseIcon';
import { FileUpload } from '@/components/FileUpload';
import { FileText, Upload } from 'lucide-react';
import { useState } from 'react';

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
    <div className='flex h-full flex-col bg-zinc-950'>
      {/* Header: compact, closer to original style */}
      <header className='shrink-0 border-b border-zinc-800 bg-zinc-950/95'>
        <div className='mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3'>
            <DocwiseIcon className='h-9 w-9 shrink-0 rounded-lg' />
            <div>
              <h1 className='text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl'>
                DocWise
              </h1>
              <p className='mt-0.5 text-xs text-zinc-400 sm:text-sm'>
                Upload any PDF and get grounded, AI-powered answers from that
                document.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main: full height when chatting, padded when uploading */}
      <main
        className={`mx-auto flex w-full max-w-5xl flex-1 flex-col min-h-0 px-4 sm:px-6 lg:px-8 ${
          documentId ? 'gap-0 py-3' : 'gap-6 py-6 sm:py-8'
        }`}
      >
        {!documentId ? (
          <>
            {/* Upload: generous space and padding */}
            <section className='shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8'>
              <h2 className='text-base font-semibold text-zinc-100'>
                Upload a PDF
              </h2>
              <p className='mt-1.5 text-sm text-zinc-500'>
                We&apos;ll parse and index your file so you can ask questions
                about it.
              </p>
              <div className='mt-6'>
                <FileUpload onUploadComplete={handleUploadComplete} />
              </div>
            </section>

            {/* Placeholder: large, friendly empty state */}
            <section className='flex flex-1 flex-col min-h-max rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30'>
              <div className='flex flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center'>
                <div className='flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800'>
                  <FileText className='h-7 w-7 text-zinc-500' />
                </div>
                <div>
                  <p className='text-sm font-medium text-zinc-300'>
                    No document yet
                  </p>
                  <p className='mt-1 text-sm text-zinc-500 max-w-sm'>
                    Upload a PDF above to start. You&apos;ll then be able to ask
                    questions and get answers from your document.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className='flex flex-1 min-h-0 flex-col gap-3 sm:gap-4'>
            {/* Document info row above chat so it doesn't feel cramped */}
            <section className='flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 sm:px-5'>
              <div className='flex min-w-0 items-center gap-3'>
                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700'>
                  <FileText className='h-4 w-4 text-zinc-400' />
                </div>
                <div className='min-w-0'>
                  <p
                    className='truncate text-sm font-medium text-zinc-100'
                    title={documentName ?? undefined}
                  >
                    {documentName ?? 'Document'}
                  </p>
                  <p className='text-xs text-zinc-500'>
                    Ready to chat · Upload a different file any time.
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={handleUploadOther}
                className='inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 hover:border-zinc-600'
              >
                <Upload className='h-3.5 w-3.5 shrink-0' />
                <span>Upload other doc</span>
              </button>
            </section>

            {/* Chat: fills remaining space, now much wider */}
            <section className='flex min-h-[360px] flex-1 flex-col sm:min-h-0'>
              <div className='flex min-h-0 flex-1 flex-col'>
                <ChatWindow key={documentId} documentId={documentId} />
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer: minimal */}
      <footer className='shrink-0 border-t border-zinc-800 bg-zinc-900/80'>
        <div className='mx-auto flex max-w-6xl items-center justify-center px-4 py-3 text-xs text-zinc-500 sm:px-6 lg:px-8'>
          Built with Next.js, Groq, Gemini & Supabase
        </div>
      </footer>
    </div>
  );
}
