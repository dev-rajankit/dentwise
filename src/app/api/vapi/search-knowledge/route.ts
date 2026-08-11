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

// Vapi's tool-response parser fails on line breaks - its docs require
// single-line strings, and a `result` containing "\n" is silently dropped, so
// the model answers as if the tool returned nothing. Collapse all whitespace.
function toSingleLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

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

type VapiBody = {
  question?: unknown;
  message?: {
    toolCallList?: ToolCall[];
    toolCalls?: ToolCall[];
  };
};

/** Non-empty strings only - a blank argument is as useless as a missing one. */
function asQuestion(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

/** Reads `.question` off an arguments object. */
function fromArgsObject(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return asQuestion((raw as Record<string, unknown>).question);
}

/** Reads `.question` off a JSON-encoded arguments string. */
function fromArgsString(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    return fromArgsObject(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/**
 * Vapi sends different payload shapes depending on the tool type (custom-tool
 * webhook vs "API Request"), and its docs disagree about whether `arguments` is
 * an object or a JSON-encoded string. Every known shape is tried in a fixed
 * order; the first that yields a non-empty string wins.
 *
 * The path labels are reported verbatim in the 400 response so a future format
 * change is diagnosable straight from the log, without another debug cycle.
 */
const QUESTION_PATHS = [
  "message.toolCallList[0].arguments.question",
  "message.toolCalls[0].function.arguments.question (object)",
  "question",
  "message.toolCalls[0].function.arguments (JSON string) .question",
  "message.toolCalls[0].arguments.question (object or JSON string)",
] as const;

function extractToolCall(body: unknown): {
  toolCallId: string;
  question?: string;
  triedPaths: readonly string[];
  topLevelKeys: string[];
} {
  const typed = (body ?? {}) as VapiBody;
  const message = typed.message;
  const listCall = message?.toolCallList?.[0];
  const legacyCall = message?.toolCalls?.[0];

  const question =
    // a. current webhook format (object or JSON string)
    fromArgsObject(listCall?.arguments) ??
    fromArgsString(listCall?.arguments) ??
    // b. legacy webhook variant, arguments as an object
    fromArgsObject(legacyCall?.function?.arguments) ??
    // c. direct parameter format - what the "API Request" tool type sends
    asQuestion(typed.question) ??
    // d. legacy variant with arguments as a JSON-encoded string
    fromArgsString(legacyCall?.function?.arguments) ??
    // e. legacy variant without the `function` wrapper (kept from phase 6)
    fromArgsObject(legacyCall?.arguments) ??
    fromArgsString(legacyCall?.arguments);

  // the simple format carries no tool call id; synthesise one so the response
  // still has vapi's expected structure.
  const toolCallId = listCall?.id ?? legacyCall?.id ?? `unknown-${Date.now()}`;

  return {
    toolCallId,
    question,
    triedPaths: QUESTION_PATHS,
    // keys only, never values - the body may carry caller-identifying data.
    topLevelKeys:
      body && typeof body === "object" ? Object.keys(body as object) : [],
  };
}

export async function POST(request: Request) {
  // 🔍 TEMPORARY DEBUG - delete this block once the vapi payload shape is confirmed.
  const clonedBody = await request.clone().json();
  console.log("🔍 VAPI RAW REQUEST:", JSON.stringify(clonedBody, null, 2));

  // 1. auth first - before any embedding call or database access.
  const expected = process.env.VAPI_TOOL_SECRET;
  if (!expected) {
    console.error("❌ VAPI_TOOL_SECRET not configured");
    return NextResponse.json(
      { error: "Tool endpoint not configured" },
      { status: 500 },
    );
  }

  // Vapi can present the secret two ways depending on how the tool is
  // configured: a custom `x-vapi-secret` header, or a Bearer Token credential
  // that sends `Authorization: Bearer <token>`. Accept either, so the dashboard
  // choice doesn't have to be re-litigated in code.
  //
  // Trimmed: secrets pasted into a dashboard field routinely pick up a
  // trailing space or newline, which would otherwise fail on length alone.
  const wanted = expected.trim();
  const rawSecretHeader = request.headers.get(SECRET_HEADER)?.trim();
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  // a duplicate header (custom header AND a credential both sending
  // x-vapi-secret) arrives comma-joined as "secret, secret", so test the parts
  // too rather than failing on a config overlap that is otherwise correct.
  const candidates = [rawSecretHeader, bearer]
    .filter((v): v is string => !!v)
    .flatMap((v) => [v, ...v.split(",").map((part) => part.trim())]);
  const authorized = candidates.some((v) => secretMatches(v, wanted));

  if (!authorized) {
    // distinguish "nothing arrived" from "arrived but wrong" - they have
    // completely different fixes. lengths and names only, never values.
    const headerNames = [...request.headers.keys()].filter((h) =>
      /secret|auth|token|vapi/i.test(h),
    );
    console.warn(
      `🚫 Rejected knowledge-search call: ${
        candidates.length === 0
          ? `no credential presented (neither '${SECRET_HEADER}' nor 'authorization')`
          : `credential presented but did not match (lengths received: [${candidates
              .map((c) => c.length)
              .join(", ")}], expected ${wanted.length})`
      }. auth-ish headers seen: [${headerNames.join(", ") || "none"}]`,
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

  const { toolCallId, question, triedPaths, topLevelKeys } =
    extractToolCall(body);

  // 3. validate. a missing toolCallId is no longer fatal - the simple "API
  // Request" format has none, and extractToolCall synthesises a fallback.
  if (!question) {
    console.error(
      `❌ No 'question' found. top-level keys: [${topLevelKeys.join(", ")}]. tried: ${triedPaths.join(" | ")}`,
    );
    return NextResponse.json(
      {
        error: "Missing 'question' argument",
        // keys and path labels only - no request values are echoed back.
        receivedTopLevelKeys: topLevelKeys,
        triedPaths,
      },
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
        : toSingleLine(
            chunks
              .map(
                (chunk, i) => `[${i + 1}] (${chunk.source}) ${chunk.content}`,
              )
              .join(" | "),
          );

    console.log(
      `🔎 knowledge search "${question.slice(0, 60)}" -> ${chunks.length} chunk(s)`,
    );

    // dual shape on purpose. a custom-tool webhook reads results[].result and
    // ignores the rest; an "API Request" tool appears to hand the raw response
    // body straight to the model (vapi rendered our raw 401 body as the tool
    // result), so a top-level `result` string keeps that case readable instead
    // of feeding it the whole envelope as noise.
    return NextResponse.json(
      { result, results: [{ toolCallId, result }] },
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
