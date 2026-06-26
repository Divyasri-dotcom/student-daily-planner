# Standup Wall — AI Daily Standup Clarity Board

Standup Wall is a full-stack AI web application for daily team standups. Team members log in, post what they completed, what they are doing today, and what is blocking them. Groq AI converts those raw updates into a clear summary, blocker detection, risk level, clarity score, follow-up question, and next action.

**Tagline:** Updates in, clarity out.

## Why this idea fits the challenge

The assigned build is **Standup Wall**. This final version directly matches that name: it is not just a normal posting app. It solves a real team problem by turning messy standup updates into useful project clarity.

## Core Features

- JWT cookie authentication: signup, login, logout.
- Protected CRUD for standup updates: create, read, edit, delete.
- Reaction system for teammates: clear, blocker, support, follow-up.
- Real server-side Groq SDK call in `app/lib/ai.js`.
- API key is read only from `process.env.GROQ_API_KEY`.
- AI returns structured JSON: summary, blockers, next action, risk level, clarity score, follow-up question.
- Team Pulse dashboard: total updates, open blockers, average clarity, high-risk count.
- Guardrails: input validation, error responses, model failure fallback, MongoDB fallback for local development.
- Vercel-ready configuration.

## Challenge Completion

### Day 1 — Spec + Foundation

- Created a runnable Next.js App Router project.
- Added this README with project purpose, screens, setup, and deploy instructions.
- App runs locally with `npm run dev`.

### Day 2 — Build the Core App

- Added authentication using JWT cookies and bcrypt password hashing.
- Added a protected Standup Update entity.
- Implemented full CRUD routes and UI:
  - Create standup update
  - Read live wall feed
  - Edit own update
  - Delete own update
- Added teammate reactions.
- Added Vercel configuration.

### Day 3 — Add the Brain

- Imported the Groq SDK server-side inside `app/lib/ai.js`.
- Reads the secret key from `process.env.GROQ_API_KEY`.
- Calls the LLM from the `/api/posts` route when a standup is created or edited.
- The key is never exposed to the browser.

### Day 4 — Build Your AI Feature

Real user input flows through the AI pipeline:

```text
Yesterday + Today + Blockers + Confidence
→ /api/posts
→ Groq LLM
→ structured JSON
→ rendered in the Standup Wall UI
```

The AI output includes:

- Clarity score from 1 to 10
- One-line summary
- Detected blockers
- Risk level
- Next action
- Follow-up question

### Day 5 — Polish + Ship

- Added input validation and helpful API error messages.
- Added fallback analysis if the AI key is missing or Groq fails.
- Added MongoDB support for production persistence.
- Added local JSON fallback for development and in-memory fallback if production storage is missing.
- Cleaned the project for GitHub and Vercel: no `node_modules`, no `.next`, no `.env.local`, no test data.

## Main Screens

1. **Authentication panel** — create an account and log in.
2. **Standup composer** — enter yesterday, today, blockers, and confidence.
3. **Live wall feed** — view team updates and AI analysis.
4. **Edit mode** — update a standup and re-run AI analysis.
5. **Team Pulse dashboard** — see blockers, average clarity, high-risk items, and latest next action.

## Environment Variables

Create `.env.local` for local development:

```env
JWT_SECRET=replace-this-with-a-long-random-secret
GROQ_API_KEY=your_groq_api_key_here
MONGODB_URI=your_mongodb_connection_string
STANDUP_STORAGE=local
```

For Vercel production, add these in **Project Settings → Environment Variables**:

```env
JWT_SECRET=your_long_random_secret
GROQ_API_KEY=your_groq_api_key
MONGODB_URI=your_mongodb_connection_string
```

`STANDUP_STORAGE=local` is only for local testing. For production, use MongoDB.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

## Deploy on Vercel

1. Push this project to a public GitHub repository.
2. Import the repository into Vercel.
3. Add `JWT_SECRET`, `GROQ_API_KEY`, and `MONGODB_URI` in Vercel environment variables.
4. Deploy.
5. Paste the GitHub repo URL and deployed Vercel URL in the course submission.

## Demo Link

Add your deployed URL here after Vercel deployment:

```text
https://your-standup-wall.vercel.app
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- Groq SDK
- JWT authentication
- bcryptjs password hashing
- MongoDB / Mongoose
- Local JSON development fallback
- In-memory safety fallback for demo environments without MongoDB
