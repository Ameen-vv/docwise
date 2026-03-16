-- Replace match_chunks so it can filter by document. Your existing function is (match_count, query_embedding).
-- Run this in Supabase → SQL Editor. If chunks.embedding uses another dimension, change vector(1536).

create or replace function match_chunks(
  match_count int,
  query_embedding vector(1536),
  filter_document_id uuid default null
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where (filter_document_id is null or c.document_id = filter_document_id)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
