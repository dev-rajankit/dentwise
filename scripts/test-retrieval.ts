// Manual check of retrieveRelevantChunks() against the ingested knowledge base.
//
// Read-only: no writes, no deletes. Makes one embedding request per question
// (5 total, ~$0.000005).
//
//   node --env-file=.env --import tsx scripts/test-retrieval.ts

import { prisma } from "../src/lib/prisma";
import {
  MAX_RELEVANT_DISTANCE,
  RETRIEVAL_LIMIT,
  retrieveRelevantChunks,
} from "../src/lib/rag/retrieval";

const TESTS: { question: string; expect: string }[] = [
  {
    question: "how much is a cleaning",
    expect: "pricing - Teeth Cleaning; near-verbatim wording overlap",
  },
  {
    question: "what does it cost to get my teeth polished",
    expect:
      "pricing - Teeth Cleaning; SEMANTIC test, shares no content word with 'Teeth Cleaning'",
  },
  {
    question: "who does oral surgery",
    expect: "doctors - Dr. Akshat Gupta",
  },
  {
    question: "what's the capital of France",
    expect: "NOTHING - out of scope, must be emptied by the threshold filter",
  },
  {
    // in-domain but genuinely unanswerable: no whitening chunk exists, yet
    // "how much" overlaps every pricing chunk. this is the hallucination-risk
    // case - if pricing rows come back under threshold, the cutoff is too
    // loose, which is exactly the signal we want before tuning.
    question: "do you do teeth whitening and how much is it",
    expect:
      "NOTHING ideally - no whitening chunk exists; watch for false pricing hits",
  },
];

async function main() {
  const [{ rows }] = await prisma.$queryRaw<{ rows: number }[]>`
    SELECT count(*)::int AS rows FROM knowledge_chunks
  `;
  console.log(`knowledge_chunks rows : ${rows}`);
  console.log(
    `threshold             : ${MAX_RELEVANT_DISTANCE} (starting guess, untuned)`,
  );
  console.log(`candidates per query  : ${RETRIEVAL_LIMIT}`);

  if (rows === 0) {
    throw new Error(
      "knowledge_chunks is empty - run scripts/ingest-knowledge-base.ts first, " +
        "otherwise every result below would be empty for the wrong reason.",
    );
  }

  for (const [index, test] of TESTS.entries()) {
    console.log(`\n${"-".repeat(72)}`);
    console.log(`Q${index + 1}: ${JSON.stringify(test.question)}`);
    console.log(`expect: ${test.expect}`);

    const results = await retrieveRelevantChunks(test.question);

    if (results.length === 0) {
      console.log(
        "  -> NO CHUNKS RETURNED (everything filtered out by threshold)",
      );
      continue;
    }

    console.log(`  -> ${results.length} chunk(s) passed the threshold:`);
    for (const [rank, chunk] of results.entries()) {
      console.log(
        `     ${rank + 1}. [${chunk.source.padEnd(9)}] d=${chunk.distance.toFixed(4)}  ${chunk.content.slice(0, 58)}...`,
      );
    }
  }

  console.log(`\n${"-".repeat(72)}`);
  console.log("done - no data was modified.");
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
