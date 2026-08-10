// Source content for the voice agent's RAG knowledge base. Content only -
// nothing here reads the database or computes embeddings. A later phase walks
// this array, embeds each `content` string, and writes the rows into
// knowledge_chunks (which needs raw SQL, since prisma client cannot see the
// Unsupported("vector(1536)") column).
//
// One entry = one chunk = one embedding = one row. Keep each entry
// self-contained: retrieval returns a single chunk with no surrounding
// context, so a chunk that only makes sense next to its neighbour will read
// as a non-answer when it comes back on its own.

export type KnowledgeSource =
  | "pricing"
  | "doctors"
  | "policy"
  | "faq"
  | "aftercare";

export type KnowledgeChunkSeed = {
  content: string;
  source: KnowledgeSource;
};

export const knowledgeBaseSeed: KnowledgeChunkSeed[] = [
  {
    content:
      "Regular Checkup: $120, 60 minutes. Includes a full oral examination, X-rays if needed, and an oral health assessment. Recommended every 6 months.",
    source: "pricing",
  },
  {
    content:
      "Teeth Cleaning: $90, 45 minutes. Professional plaque and tartar removal, polishing, and a fluoride treatment. Recommended twice a year.",
    source: "pricing",
  },
  {
    content:
      "Consultation: $75, 30 minutes. A discussion of dental concerns, treatment options, and a personalized care plan. No procedures performed during this visit.",
    source: "pricing",
  },
  {
    content:
      "Emergency Visit: $150, 30 minutes. For urgent issues like severe pain, broken teeth, or dental trauma. Same-day appointments prioritized when available.",
    source: "pricing",
  },
  {
    content: "Dr. Anlul Singh specializes in general dentistry.",
    source: "doctors",
  },
  {
    content: "Dr. Akshat Gupta specializes in oral surgery.",
    source: "doctors",
  },
  {
    content: "Dr. Aamish Husain specializes in orthodontics.",
    source: "doctors",
  },
  {
    content:
      "Do I need a referral to book an appointment? No, patients can book directly through the DentWise platform without a referral.",
    source: "faq",
  },
  {
    content:
      "What should I bring to my first appointment? Please bring a valid ID and any relevant dental records or insurance information, if applicable.",
    source: "faq",
  },
  {
    content:
      "Can I request a specific doctor? Yes, you can choose your preferred dentist during the booking process on the Appointments page.",
    source: "faq",
  },
  {
    content:
      "Mild tooth sensitivity to hot or cold after a cleaning is normal and usually resolves within a day or two. Persistent or severe sensitivity should be discussed with your dentist.",
    source: "aftercare",
  },
  {
    content:
      "Daily oral care basics: brushing twice daily with fluoride toothpaste, flossing once daily, and limiting sugary foods and drinks are the most effective ways to prevent cavities and gum disease.",
    source: "aftercare",
  },
];
