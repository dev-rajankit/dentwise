<div align="center">

# 🦷 DentWise

### AI-Powered Dental Platform

Book appointments, talk to an AI dental assistant, and manage a dental practice — all in one full-stack application.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#-license)

[Live Demo](https://dentwise-rouge.vercel.app) · [Features](#-features) · [Architecture](#-architecture) · [Getting Started](#-getting-started)

</div>

---

## 📖 Overview

**DentWise** is a full-stack SaaS platform for a dental practice. Patients can discover the clinic, book appointments through a guided wizard, talk to an AI voice assistant for dental questions, and subscribe to premium features. Admins manage doctors and appointments from a protected dashboard.

The project demonstrates production-grade engineering patterns: a clean three-layer data architecture, race-condition-safe booking, subscription billing, an AI voice agent, and a **RAG (Retrieval-Augmented Generation)** knowledge base that grounds the AI's answers in real clinic data.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏠 **Landing page** | Responsive marketing site that converts visitors into signups |
| 🔐 **Authentication** | Sign in with Google, GitHub, or email + verification code (via Clerk) |
| 📅 **Appointment booking** | 3-step wizard: choose doctor → pick date & time → confirm, with real-time availability |
| 🎙️ **AI voice agent** | Talk to "Riley," an AI dental assistant, directly in the browser |
| 🧠 **RAG knowledge base** | The AI answers from real clinic data (pricing, doctors, FAQs) using semantic search |
| 💳 **Subscriptions** | Free / Basic / Pro tiers with prorated upgrades (Clerk Billing, powered by Stripe) |
| 📧 **Email notifications** | Automatic booking confirmation emails (via Resend) |
| 👩‍⚕️ **Admin dashboard** | Manage doctors (CRUD) and view/update appointments — protected, admin-only |
| 🔒 **Race-condition-safe** | Database-level guarantee against double-booking the same slot |

---

## 🏗️ Architecture

DentWise is a **modular monolith** — a single deployed application with clean internal boundaries (auth, booking, voice, email, RAG). This keeps things simple to develop and deploy while remaining easy to split into services later if scale demands it.

```
                              USER'S BROWSER
  ┌──────────────────────────────────────────────────────────────┐
  │  Next.js App (React)                                          │
  │   • Server Components  → auth checks, initial data fetch      │
  │   • Client Components  → forms, clicks, interactivity         │
  │   • State: Zustand (booking wizard) + TanStack Query (cache)  │
  └───────────────┬──────────────────┬───────────────────────────┘
                  │                  │                   │
           Server Actions       API Routes         WebRTC (audio)
                  │                  │                   │
  ┌───────────────▼──────────────────▼───────────────────▼────────┐
  │                       NEXT.JS SERVER                          │
  │   Prisma (ORM) ──────►  PostgreSQL (Neon)  [users, doctors,  │
  │                                             appointments,     │
  │                                             knowledge_chunks] │
  │   Clerk SDK   ──────►  Clerk    [auth + billing → Stripe]    │
  │   Resend SDK  ──────►  Resend   [confirmation emails]        │
  │   OpenAI SDK  ──────►  OpenAI   [RAG embeddings]             │
  └───────────────────────────┬──────────────────────────────────┘
                              │
                        ┌─────▼──────┐
                        │  Vapi AI   │  Voice pipeline:
                        │  (voice)   │  speech→text→LLM→text→speech
                        └────────────┘  calls our RAG endpoint as a tool
```

**Two golden rules baked into this design:**

1. **The server is the only source of truth.** All auth checks, validation, and secrets live server-side. The browser is never trusted for anything security-sensitive.
2. **Rent what isn't the core value.** Auth, billing, email, and voice are handled by specialized services so we can focus on the dental booking experience.

---

## 🛠️ Tech Stack

### Frontend
| Tool | Why |
|------|-----|
| **Next.js 16 (App Router)** | Server rendering, routing, and backend in one framework |
| **React + TypeScript** | Component model + compile-time type safety |
| **Tailwind CSS** | Fast, consistent styling with utility classes |
| **Shadcn UI** | Copy-paste components you fully own and can customize |
| **TanStack Query** | Server-state caching, background refetching, loading/error states |
| **Zustand** | Lightweight state management for the booking wizard |

### Backend & Data
| Tool | Why |
|------|-----|
| **PostgreSQL (Neon)** | Relational data with enforced relationships; serverless, with `pgvector` |
| **Prisma** | Type-safe database access + injection protection + migrations |
| **pgvector** | Vector similarity search inside PostgreSQL (powers RAG) |

### Services
| Tool | Why |
|------|-----|
| **Clerk** | Authentication + subscription billing (wraps Stripe) |
| **Resend** | Transactional email (booking confirmations) |
| **Vapi** | AI voice agent (speech-to-text → LLM → text-to-speech) |
| **OpenAI** | Embeddings for the RAG knowledge base |
| **Vercel** | Hosting with zero-config deploys on every push |

---

## 🗄️ Data Model

Three core tables. `Appointment` is the join between `User` and `Doctor` — one user has many appointments, one doctor has many appointments, each appointment belongs to exactly one of each.

```
┌────────────────┐          ┌──────────────────┐
│     USERS      │          │     DOCTORS      │
├────────────────┤          ├──────────────────┤
│ id (PK, cuid)  │          │ id (PK, cuid)    │
│ clerkId (uniq) │          │ name, specialty  │
│ email (uniq)   │          │ gender (enum)    │
│ firstName?     │          │ isActive (bool)  │
│ lastName?      │          │ imageUrl         │
└───────┬────────┘          └─────────┬────────┘
        │ 1                           │ 1
        │ many                        │ many
        ▼                             ▼
      ┌─────────────────────────────────┐
      │          APPOINTMENTS           │
      ├─────────────────────────────────┤
      │ id (PK, cuid)                   │
      │ date, time, status (enum)       │
      │ userId  (FK → users.id)         │
      │ doctorId (FK → doctors.id)      │
      │ @@unique([doctorId, date, time])│ ← prevents double-booking
      └─────────────────────────────────┘

  + KNOWLEDGE_CHUNKS (RAG)
      │ id, content, source              │
      │ embedding vector(1536)           │ ← semantic search via pgvector
```

**Key design decisions:**
- **CUID primary keys** — don't leak record counts, safe in distributed systems, URL-friendly.
- **`clerkId` bridge field** — links a Clerk-authenticated session to our own user row, keeping our identity independent of the auth provider.
- **`isActive` soft-delete on doctors** — hide a doctor from booking without destroying their appointment history.
- **`@@unique([doctorId, date, time])`** — the database-level guarantee against double-booking (see below).

---

## 🔑 Core Engineering Patterns

### The Three-Layer Data Pattern
Every data operation flows through the same three layers, keeping concerns cleanly separated:

```
Server Action (lib/actions/*)   →  talks to Prisma / the database
        ↓
Custom Hook (hooks/use-*)       →  wraps in TanStack Query, owns caching
        ↓
Component (components/*)         →  renders data, handles user interaction
```

The component never touches the database; the database code never touches React. This makes each layer independently testable and swappable.

### Preventing Double-Booking (Race Conditions)
Two patients could try to book the same slot at the same time — a classic **TOCTOU** (time-of-check-to-time-of-use) race. UI checks alone can't prevent this because they run on stale data.

**The real guarantee is a database unique constraint** on `(doctorId, date, time)`. When two requests race, the database lets the first win and rejects the second with a unique-violation error (Prisma `P2002`), which we catch and turn into a friendly *"that slot was just taken — pick another time"* recovery. The database is the single point where concurrent writes are forced to serialize.

### AI Voice Agent + RAG
The voice agent ("Riley") runs a real-time pipeline: **speech-to-text → LLM → text-to-speech**, streamed over WebRTC directly between the browser and Vapi for low latency.

Instead of hardcoding clinic info into the AI's prompt, DentWise uses **RAG**:
1. Clinic facts (pricing, doctors, FAQs) are turned into **embeddings** (numeric fingerprints of meaning) and stored in PostgreSQL via `pgvector`.
2. When a patient asks a question, the question is embedded and the most **semantically similar** chunks are retrieved.
3. Those chunks are handed to the AI, which answers grounded in real data — with explicit instructions to say *"I don't have that information"* rather than guess.

This means updating the AI's knowledge is as simple as adding a row to a table — no prompt rewriting or redeployment.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- Accounts for: [Neon](https://neon.tech), [Clerk](https://clerk.com), [Resend](https://resend.com), [Vapi](https://vapi.ai), [OpenAI](https://platform.openai.com)

### 1. Clone and install

```bash
git clone https://github.com/dev-rajankit/dentwise.git
cd dentwise
npm install
```

### 2. Set up environment variables

Create a `.env` file in the root (see [Environment Variables](#-environment-variables) below for the full list):

```bash
cp .env.example .env
# then fill in your keys
```

### 3. Set up the database

```bash
# generate the Prisma client
npx prisma generate

# apply migrations (creates tables + pgvector extension)
npx prisma migrate deploy

# seed the RAG knowledge base (embeds clinic facts into the DB)
node --env-file=.env --import tsx scripts/ingest-knowledge-base.ts
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🔐 Environment Variables

> ⚠️ **Security note:** only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Everything else stays server-only. **Never** prefix a real secret with `NEXT_PUBLIC_`.

| Variable | Public? | Description |
|----------|---------|-------------|
| `DATABASE_URL` | ❌ | Pooled Neon connection string (used at runtime) |
| `DIRECT_URL` | ❌ | Unpooled Neon connection (used by Prisma migrations) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ❌ | Clerk secret key |
| `ADMIN_EMAIL` | ❌ | Email address granted admin access |
| `RESEND_API_KEY` | ❌ | Resend API key for sending emails |
| `NEXT_PUBLIC_VAPI_API_KEY` | ✅ | Vapi public key (browser voice SDK) |
| `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | ✅ | ID of the Vapi assistant to connect to |
| `OPENAI_API_KEY` | ❌ | OpenAI key for generating RAG embeddings |
| `VAPI_TOOL_SECRET` | ❌ | Shared secret protecting the RAG webhook endpoint |
| `NEXT_PUBLIC_APP_URL` | ✅ | App base URL (for links in emails) |

---

## 📁 Project Structure

```
dentwise/
├── prisma/
│   ├── schema.prisma            # data model
│   └── migrations/              # versioned schema history (incl. pgvector)
├── scripts/
│   └── ingest-knowledge-base.ts # embeds clinic facts into knowledge_chunks
├── src/
│   ├── app/
│   │   ├── (routes)/            # pages: landing, dashboard, appointments, voice, admin, pro
│   │   └── api/
│   │       ├── send-appointment-email/   # Resend email endpoint
│   │       └── vapi/search-knowledge/    # RAG webhook (called by Vapi)
│   ├── components/              # UI, grouped by feature
│   ├── hooks/                   # TanStack Query hooks (Layer 2)
│   ├── lib/
│   │   ├── actions/             # Server Actions (Layer 1)
│   │   └── rag/                 # embeddings + retrieval logic
│   └── stores/                  # Zustand store (booking wizard)
└── middleware.ts                # Clerk auth on every request
```

---

## 🧠 How the RAG Pipeline Works

```
Patient asks: "How much is a cleaning?"
      │
      ▼
1. Embed the question  → [0.04, -0.01, ... ]  (1536 numbers)
      │
      ▼
2. pgvector similarity search  (ORDER BY embedding <=> question  LIMIT 5)
      │
      ▼
3. Closest chunks returned  → "Teeth Cleaning: $90, 45 minutes..."
      │
      ▼
4. If nothing relevant enough → return "no info found" (AI says so honestly)
      │
      ▼
5. Chunks handed to the AI → it speaks a grounded, accurate answer
```

The knowledge base lives in the `knowledge_chunks` table and is populated by `scripts/ingest-knowledge-base.ts`.

---

## 🚢 Deployment

DentWise deploys to **Vercel**. On every push to `main`, Vercel builds and deploys automatically.

**Setup:**
1. Import the repo into Vercel.
2. Add all [environment variables](#-environment-variables) under **Settings → Environment Variables** (for **Production** and **Preview**).
3. The build runs `prisma migrate deploy` before building, so schema changes apply automatically on deploy.

> **Note:** `NEXT_PUBLIC_` variables are baked in at build time — after adding or changing one, trigger a fresh deploy for it to take effect.

---

## 🗺️ Roadmap

- [ ] Appointment cancellation (free the slot + preserve history via a partial unique index)
- [ ] Voice-driven booking (AI books appointments via tool calling)
- [ ] Real-time availability updates (WebSocket/SSE) so slots update live across users
- [ ] Background job queue for emails (instant confirmation, async delivery + retries)
- [ ] Appointment reminders (24h before, via scheduled jobs)

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<div align="center">

Built with ❤️ using Next.js, Prisma, and a lot of careful engineering.

</div>
