// One-off manual check that generateEmbedding() really reaches OpenAI and
// gets a usable vector back. Not part of the app and not imported by it.
//
// Touches no database. Makes exactly one billed embedding request.
//
//   node --env-file=.env --import tsx scripts/test-embedding.ts

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  generateEmbedding,
} from "../src/lib/rag/embeddings";

const TEST_INPUT = "Regular Checkup: $120, 60 minutes.";

async function main() {
  console.log(`model:  ${EMBEDDING_MODEL}`);
  console.log(`input:  ${JSON.stringify(TEST_INPUT)}\n`);

  const embedding = await generateEmbedding(TEST_INPUT);

  console.log(`length:      ${embedding.length}`);
  console.log(`expected:    ${EMBEDDING_DIMENSIONS}`);
  console.log(`first 5:     [${embedding.slice(0, 5).join(", ")}]`);
  console.log(
    `all finite:  ${embedding.every((n) => typeof n === "number" && Number.isFinite(n))}`,
  );

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }

  console.log("\nOK - real vector returned, nothing swallowed.");
}

main().catch((error) => {
  console.error("\nFAILED:", error instanceof Error ? error.message : error);
  if (error instanceof Error && error.cause)
    console.error("cause:", error.cause);
  process.exit(1);
});
