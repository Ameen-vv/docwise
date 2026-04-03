# DocWise

Upload a PDF, index it with embeddings, and chat with an assistant that answers **only from that document**. The UI is a Next.js app with a dark theme; retrieval uses [Supabase](https://supabase.com) (pgvector) and [Google Gemini](https://ai.google.dev/) embeddings; replies stream from [Groq](https://groq.com/).

## Features

- **PDF upload** — Text is extracted server-side, split into overlapping chunks, embedded, and stored per document.
- **Grounded chat** — Each question is embedded, similar chunks are retrieved for the **current** document only, and a Groq model answers with that context.
- **Streaming responses** — Answers stream to the client via the Vercel AI SDK.

## Stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Database & vectors | Supabase (`documents`, `chunks`, `match_chunks` RPC) |
| Embeddings | Gemini `gemini-embedding-001` (1536 dimensions) |
| Chat | Groq (default: `llama-3.1-8b-instant`, overridable) |
| PDF parsing | `pdf-parse` |

## Prerequisites

- **Node.js** (LTS recommended)
- **Yarn** — this repo pins `packageManager` to Yarn 1.x in `package.json`
- A **Supabase** project with `documents` and `chunks` tables, vector similarity search, and a `match_chunks` function (see [Supabase setup](#supabase-setup))
- API keys: **Gemini**, **Groq**, and Supabase **URL** + **anon key**

## Environment variables

Create `.env.local` in the project root (never commit real keys):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (used from server routes) |
| `GEMINI_API_KEY` | Yes | Google AI API key for embeddings |
| `GROQ_API_KEY` | Yes | Groq API key for chat completions |
| `GROQ_MODEL` | No | Groq model id (default: `llama-3.1-8b-instant`) |

The app fails fast at runtime if Supabase env vars are missing (see `src/lib/supabase.ts`). Chat and upload routes return clear errors if `GEMINI_API_KEY` or `GROQ_API_KEY` are missing.

## Supabase setup

1. Configure your database so uploads can insert into `documents` and `chunks`, and so `chunks.embedding` matches **1536** dimensions (or adjust code/migrations consistently).
2. Ensure a `match_chunks` RPC exists for vector search. To **restrict retrieval to the active document**, run the migration in the Supabase SQL Editor:

   - File: [`supabase/migrations/scope_match_chunks_by_document.sql`](supabase/migrations/scope_match_chunks_by_document.sql)

   More detail: [`supabase/README.md`](supabase/README.md).

## Local development

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). Upload a PDF, then ask questions in the chat panel.

## Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start the development server |
| `yarn build` | Production build |
| `yarn start` | Run the production server (after `build`) |
| `yarn lint` | Run ESLint |

## Project layout (high level)

- `src/app/page.tsx` — Upload flow and chat shell
- `src/app/api/upload/route.ts` — PDF → chunks → embeddings → Supabase
- `src/app/api/chat/route.ts` — Embed query, `match_chunks`, stream Groq reply
- `src/app/api/keep-alive/route.ts` — Optional lightweight Supabase ping (e.g. to wake idle compute)

## Deployment

Deploy like any Next.js app (e.g. [Vercel](https://vercel.com/)). Set the same environment variables in your host’s dashboard. Ensure serverless/runtime limits are sufficient for PDF parsing and embedding batches on upload.
