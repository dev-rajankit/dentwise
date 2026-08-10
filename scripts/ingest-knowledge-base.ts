// One-time (safely re-runnable) ingestion of the RAG knowledge base.
//
// Embeds every entry in knowledge-base-seed.ts and loads it into
// knowledge_chunks. Re-running replaces the table contents wholesale, so it is
// idempotent: 12 entries in, 12 rows out, every time.
//
// Makes 12 real OpenAI embedding requests (~370 tokens total, well under a
// cent - see the cost note printed at startup).
//
//   node --env-file=.env --import tsx scripts/ingest-knowledge-base.ts

import cuid from "cuid";
import { prisma } from "../src/lib/prisma";
import { EMBEDDING_MODEL, generateEmbedding } from "../src/lib/rag/embeddings";
import { knowledgeBaseSeed } from "../src/lib/rag/knowledge-base-seed";

// pgvector accepts a bracketed, comma-separated literal cast from text.
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

async function main() {
  console.log(`chunks to process : ${knowledgeBaseSeed.length}`);
  console.log(`embedding model   : ${EMBEDDING_MODEL}`);
  console.log(
    `est. cost         : ~$0.00001 total (${knowledgeBaseSeed.length} requests)\n`,
  );

  // ---- phase 1: embed everything BEFORE touching the database ----
  // deliberately ordered this way so a mid-run API failure leaves the table
  // exactly as it was, rather than emptied or half-loaded.
  const prepared: {
    id: string;
    content: string;
    source: string;
    vector: string;
  }[] = [];

  for (const [index, chunk] of knowledgeBaseSeed.entries()) {
    const position = `${index + 1}/${knowledgeBaseSeed.length}`;
    try {
      const embedding = await generateEmbedding(chunk.content);
      prepared.push({
        id: cuid(),
        content: chunk.content,
        source: chunk.source,
        vector: toVectorLiteral(embedding),
      });
      console.log(
        `${position} embedded  [${chunk.source}] ${embedding.length}d - ${chunk.content.slice(0, 45)}...`,
      );
    } catch (error) {
      throw new Error(
        `chunk ${position} (source "${chunk.source}") failed to embed: ` +
          `${error instanceof Error ? error.message : String(error)}\n` +
          `  content: ${JSON.stringify(chunk.content.slice(0, 80))}\n` +
          `  nothing was written to the database.`,
        { cause: error },
      );
    }
  }

  // ---- phase 2: replace table contents atomically ----
  // DELETE rather than TRUNCATE: at 12 rows the performance difference is
  // meaningless, and DELETE takes only a ROW EXCLUSIVE lock while TRUNCATE
  // takes an ACCESS EXCLUSIVE lock that blocks even readers. DELETE also rolls
  // back cleanly here if any insert below fails. No table references
  // knowledge_chunks by foreign key (verified in schema.prisma and in
  // pg_constraint), so there is nothing to cascade to either way.
  console.log("\nclearing knowledge_chunks and inserting...");

  const inserted = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`DELETE FROM knowledge_chunks`;

      let count = 0;
      for (const row of prepared) {
        await tx.$executeRaw`
        INSERT INTO knowledge_chunks (id, content, embedding, source)
        VALUES (${row.id}, ${row.content}, ${row.vector}::vector, ${row.source})
      `;
        count += 1;
        console.log(
          `${count}/${prepared.length} done: ${row.source} chunk embedded and inserted`,
        );
      }
      return count;
    },
    // prisma's interactive-transaction default is 5s, which is uncomfortably
    // tight for 12 vector inserts against a possibly cold neon endpoint.
    { maxWait: 15_000, timeout: 60_000 },
  );

  // ---- step 5: confirm final row count ----
  const [{ rows }] = await prisma.$queryRaw<{ rows: number }[]>`
    SELECT count(*)::int AS rows FROM knowledge_chunks
  `;
  console.log(
    `\ninserted ${inserted}, table now holds ${rows} row(s) (expected ${knowledgeBaseSeed.length})`,
  );
  if (rows !== knowledgeBaseSeed.length) {
    throw new Error(
      `row count mismatch: expected ${knowledgeBaseSeed.length}, found ${rows}`,
    );
  }

  // ---- step 6: self-similarity sanity check ----
  // Query the table with the first chunk's own embedding. If the vector column
  // is genuinely queryable (not just storing bytes), the nearest neighbour must
  // be that same row at a cosine distance of ~0.
  const probe = prepared[0];
  const matches = await prisma.$queryRaw<
    { id: string; source: string; distance: number; preview: string }[]
  >`
    SELECT id, source, left(content, 50) AS preview,
           embedding <=> ${probe.vector}::vector AS distance
    FROM knowledge_chunks
    ORDER BY embedding <=> ${probe.vector}::vector
    LIMIT 1
  `;

  const nearest = matches[0];
  console.log("\nself-similarity check (<=> cosine distance):");
  console.log(`  probe row id : ${probe.id}`);
  console.log(`  nearest id   : ${nearest.id}`);
  console.log(`  nearest src  : ${nearest.source}`);
  console.log(`  preview      : ${nearest.preview}...`);
  console.log(`  distance     : ${nearest.distance}`);
  console.log(`  found itself : ${nearest.id === probe.id}`);

  if (nearest.id !== probe.id || Math.abs(nearest.distance) > 1e-6) {
    throw new Error(
      `self-similarity check failed: expected ${probe.id} at distance ~0, ` +
        `got ${nearest.id} at ${nearest.distance}`,
    );
  }

  console.log("\nOK - ingestion complete and the vector column is queryable.");
}

main()
  .catch((error) => {
    console.error("\nFAILED:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.cause)
      console.error("cause:", error.cause);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
