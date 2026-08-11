import Vapi from "@vapi-ai/web";

// inlined at build time - undefined here means the var was never set in the
// deployment environment, not that it is missing at runtime. warn loudly
// rather than letting `as string` turn it into a silent connection failure.
const publicKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;

if (!publicKey && typeof window !== "undefined") {
  console.error(
    "❌ NEXT_PUBLIC_VAPI_API_KEY is not set in this build - voice calls will fail to connect.",
  );
}

export const vapi = new Vapi(publicKey as string);