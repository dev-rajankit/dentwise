// Text -> vector, and nothing else. No database access and no knowledge-base
// awareness lives here; ingestion and retrieval are separate phases that call
// into this.
//
// SERVER-ONLY. OPENAI_API_KEY is deliberately not NEXT_PUBLIC_, so it is never
// inlined into a client bundle - which also means this module simply cannot
// work in the browser. Import it only from server components, route handlers,
// server actions, or standalone node scripts.

import OpenAI from "openai";

// must stay in sync with the vector(1536) column on knowledge_chunks - a model
// with a different output width will fail on insert, not here.
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

// lazily constructed: `new OpenAI()` throws when the key is absent, and doing
// that at module scope would break any build that merely imports this file.
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env (no NEXT_PUBLIC_ prefix - this key must stay server-side).",
    );
  }

  client = new OpenAI({ apiKey });
  return client;
}

/**
 * Embeds a single string with OpenAI's text-embedding-3-small.
 *
 * @throws if `text` is blank, if the API call fails, or if the response does
 * not contain a usable vector. Never resolves to undefined or an empty array -
 * a caller that gets a value back can trust it.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (typeof text !== "string" || text.trim().length === 0) {
    // guard before the network call - the API bills for empty input too.
    throw new Error("generateEmbedding: text must be a non-empty string.");
  }

  let response: Awaited<ReturnType<OpenAI["embeddings"]["create"]>>;
  try {
    response = await getClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
  } catch (error) {
    // surface the provider's own message (bad key, rate limit, network) rather
    // than a generic failure, and keep the original around via `cause`.
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`generateEmbedding: OpenAI request failed - ${detail}`, {
      cause: error,
    });
  }

  const embedding = response.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(
      "generateEmbedding: OpenAI returned no embedding for the given input.",
    );
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    // catches a model/schema mismatch here instead of at the insert, where the
    // error would point at the database rather than the real cause.
    throw new Error(
      `generateEmbedding: expected ${EMBEDDING_DIMENSIONS} dimensions from ${EMBEDDING_MODEL}, got ${embedding.length}.`,
    );
  }

  return embedding;
}
