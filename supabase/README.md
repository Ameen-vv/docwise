# Supabase setup for DocChat

## Scoping chat to the current document

So that the chat API only retrieves chunks from the **current** document (and not from other uploads), run the migration that adds a document filter to `match_chunks`:

1. Open your Supabase project → **SQL Editor**.
2. Run the contents of **`migrations/scope_match_chunks_by_document.sql`**.

If your `chunks.embedding` column uses a dimension other than 1536, edit the migration and change `vector(1536)` to your dimension (e.g. `vector(768)`).

After this, the chat API will pass `filter_document_id` to `match_chunks`, so you always get chunks only from the uploaded document you’re chatting with.
