// app/api/vapi/search-knowledge/route.ts
//
// Vapi custom-tool webhook. Thin HTTP wrapper around retrieveRelevantChunks -
// no database logic of its own, and read-only.
//
// Request  (vapi -> us): { message: { type: "tool-calls", toolCallList: [...] } }
// Response (us -> vapi): { results: [{ toolCallId, result }] }
export const runtime = "nodejs";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { retrieveRelevantChunks } from "@/lib/rag/retrieval";

const SECRET_HEADER = "x-vapi-secret";
const NO_RESULTS_MESSAGE =
  "No relevant information was found in the knowledge base for this question.";

/** Constant-time compare so the secret can't be probed a byte at a time. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so guard first. length is not
  // itself sensitive here.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type ToolCall = {
  id?: string;
  name?: string;
  arguments?: unknown;
  function?: { name?: string; arguments?: unknown };
};

/**
 * Vapi's docs show the tool call carrying `name`/`arguments` at the top level,
 * while some payloads nest them under `function` (the OpenAI-style shape), and
 * `arguments` may arrive as an object or as a JSON-encoded string. All variants
 * are accepted rather than betting on one and failing silently in production.
 */
function extractToolCall(body: unknown): {
  toolCallId?: string;
  question?: string;
} {
  const message = (
    body as { message?: { toolCallList?: ToolCall[]; toolCalls?: ToolCall[] } }
  )?.message;
  const call = message?.toolCallList?.[0] ?? message?.toolCalls?.[0];
  if (!call) return {};

  const rawArgs = call.arguments ?? call.function?.arguments;
  let args: Record<string, unknown> | undefined;

  if (typeof rawArgs === "string") {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      args = undefined;
    }
  } else if (rawArgs && typeof rawArgs === "object") {
    args = rawArgs as Record<string, unknown>;
  }

  const question = args?.question;
  return {
    toolCallId: call.id,
    question: typeof question === "string" ? question : undefined,
  };
}

export async function POST(request: Request) {
  // 1. auth first - before any embedding call or database access.
  const expected = process.env.VAPI_TOOL_SECRET;
  if (!expected) {
    console.error("❌ VAPI_TOOL_SECRET not configured");
    return NextResponse.json(
      { error: "Tool endpoint not configured" },
      { status: 500 },
    );
  }

  const provided = request.headers.get(SECRET_HEADER);
  if (!provided || !secretMatches(provided, expected)) {
    console.warn(
      "🚫 Rejected knowledge-search call: missing or invalid secret",
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. parse the vapi payload.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { toolCallId, question } = extractToolCall(body);

  // 3. validate. without a toolCallId vapi cannot match a result to its call,
  // so there is nothing useful to return in the results shape.
  if (!toolCallId) {
    console.error(
      "❌ No tool call id in payload:",
      JSON.stringify(body).slice(0, 500),
    );
    return NextResponse.json(
      { error: "Missing tool call id" },
      { status: 400 },
    );
  }
  if (!question || question.trim().length === 0) {
    console.error(`❌ Missing 'question' argument for tool call ${toolCallId}`);
    return NextResponse.json(
      { error: "Missing 'question' argument" },
      { status: 400 },
    );
  }

  // 4 + 5. retrieve and format.
  try {
    const chunks = await retrieveRelevantChunks(question);

    // an empty array is a real answer ("we don't know"), not a failure - the
    // next phase's system prompt depends on the agent being told this plainly
    // rather than receiving silence it might paper over.
    const result =
      chunks.length === 0
        ? NO_RESULTS_MESSAGE
        : chunks
            .map((chunk, i) => `[${i + 1}] (${chunk.source}) ${chunk.content}`)
            .join("\n\n");

    console.log(
      `🔎 knowledge search "${question.slice(0, 60)}" -> ${chunks.length} chunk(s)`,
    );

    return NextResponse.json(
      { results: [{ toolCallId, result }] },
      { status: 200 },
    );
  } catch (error) {
    // 6. never leak a stack trace to vapi, and never 500 here: a 200 carrying a
    // spoken-language failure message lets the agent apologise gracefully
    // mid-call instead of the tool call collapsing. the real error goes to the
    // server log.
    console.error("❌ Knowledge search failed:", error);
    if (error instanceof Error && error.cause)
      console.error("cause:", error.cause);

    return NextResponse.json(
      {
        results: [
          {
            toolCallId,
            result:
              "The knowledge base could not be reached right now. Please let the caller know you cannot look this up at the moment.",
          },
        ],
      },
      { status: 200 },
    );
  }
}
