// Question -> most relevant knowledge chunks. Read-only: this module never
// writes to knowledge_chunks.
//
// SERVER-ONLY, transitively - it imports embeddings.ts (which needs the
// server-side OPENAI_API_KEY) and the prisma client.

import { prisma } from "../prisma";
import { generateEmbedding } from "./embeddings";

/**
 * Cosine distance cutoff, above which a row is treated as irrelevant.
 *
 * STARTING GUESS, NOT A TUNED NUMBER. `<=>` returns roughly 0 (identical) to 2
 * (opposite), and 0.5 is a plausible-but-unvalidated cutoff for a knowledge
 * base this small. Tune it against real measured distances in a later phase -
 * do not treat this value as load-bearing yet.
 */
export const MAX_RELEVANT_DISTANCE = 0.5;

/** How many candidates to pull before the threshold filter is applied. */
export const RETRIEVAL_LIMIT = 5;

export interface RetrievedChunk {
  content: string;
  source: string;
  distance: number;
}

/**
 * Finds the knowledge chunks closest in meaning to `question`.
 *
 * Returns at most RETRIEVAL_LIMIT chunks, nearest first, with everything
 * beyond MAX_RELEVANT_DISTANCE removed. Returns an empty array when nothing
 * clears the threshold - callers get "no relevant knowledge" rather than the
 * best of a bad bunch, which is what stops the agent answering from noise.
 *
 * @throws if `question` is blank, or if embedding/query fails.
 */
export async function retrieveRelevantChunks(
  question: string,
): Promise<RetrievedChunk[]> {
  if (typeof question !== "string" || question.trim().length === 0) {
    throw new Error(
      "retrieveRelevantChunks: question must be a non-empty string.",
    );
  }

  const embedding = await generateEmbedding(question);
  // same literal + explicit cast the ingestion script uses.
  const literal = `[${embedding.join(",")}]`;

  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT content,
           source,
           embedding <=> ${literal}::vector AS distance
    FROM knowledge_chunks
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${RETRIEVAL_LIMIT}
  `;

  return rows.filter((row) => row.distance <= MAX_RELEVANT_DISTANCE);
}
