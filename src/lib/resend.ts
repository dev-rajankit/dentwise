// lib/resend.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Add this for debugging
if (!process.env.RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY is not set!");
}

export default resend;