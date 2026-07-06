# Shariah RAG — Setup and Operations Guide

The Shariah Compliance Agent uses a **Retrieval-Augmented Generation (RAG)** pipeline to query
AAOIFI Shari'a Standards and CBN Non-Interest Financial Institutions (NIFI) Framework documents.
This guide covers first-time setup, running the ingestion, verifying the index, and updating the
knowledge base when new documents arrive.

---

## Architecture Overview

```
PDFs in data/shariah/
        │
        ▼
  npm run rag:ingest:shariah          ← one-time (re-run when PDFs change)
        │
        │  PDFLoader → RecursiveCharacterTextSplitter (1200 chars, 200 overlap)
        │  → OpenAIEmbeddings (text-embedding-3-small)
        │  → FaissStore.save()
        ▼
data/shariah-vectorstore/             ← persisted FAISS index (git-ignored)
        │
        ▼
  npm run mcp:shariah                 ← running MCP server (loaded once per start)
        │
        │  FaissStore.load() → similaritySearchWithScore()
        ▼
  Shariah Agent (shariah.ts)          ← queries server, returns COMPLIANT / REQUIRES_REVIEW / NON_COMPLIANT
        │
        ▼
  Compliance Agent (compliance.ts)    ← Step 0 result injected; drives Canton choice
```

---

## Prerequisites

- Node.js 18+ and `npm install` run inside `agents/`
- `OPENAI_API_KEY` set in `agents/.env` (used for embeddings)
- PDF documents placed in `agents/data/shariah/`

---

## Step 1 — Obtain the PDFs

The knowledge base requires four documents:

| Document | Authority | Where to get it |
|---|---|---|
| AAOIFI Shari'a Standard No. 8 — Murabahah | AAOIFI | [aaoifi.com](https://aaoifi.com/standards/?lang=en) — purchase or institutional access |
| AAOIFI Shari'a Standard No. 28 — Prohibited Business Activities | AAOIFI | same |
| AAOIFI Shari'a Standard No. 40 — Distribution of Profit | AAOIFI | same |
| CBN Guidelines for Regulation and Supervision of Non-Interest Financial Institutions | CBN | [cbn.gov.ng](https://www.cbn.gov.ng) — free download under Banking Regulation |

You can also add supplementary documents (IFSB standards, CBN circulars, OIC Fiqh Academy resolutions)
by dropping them in the same folder. The ingest script processes all `.pdf` files it finds.

---

## Step 2 — Name the Files

Place files in `agents/data/shariah/` using these names (the ingest script reads the filename
to tag authority and standard number):

```
agents/data/shariah/
├── aaoifi-standard-8.pdf      → authority: AAOIFI, standard: AAOIFI-8
├── aaoifi-standard-28.pdf     → authority: AAOIFI, standard: AAOIFI-28
├── aaoifi-standard-40.pdf     → authority: AAOIFI, standard: AAOIFI-40
└── cbn-nifi-framework.pdf     → authority: CBN,    standard: CBN
```

**Naming rules:**
- Files with `cbn` anywhere in the name → tagged `authority: "CBN"`
- All other files → tagged `authority: "AAOIFI"`
- Files matching `standard-N` or `standard_N` → tagged `standard: "AAOIFI-N"` (or `"CBN-N"`)
- Any other PDF → tagged with just the authority, no standard number

---

## Step 3 — Configure Environment

Copy `.env.example` to `.env` if you haven't already:

```bash
cd agents
cp .env.example .env
```

Ensure these variables are set in `agents/.env`:

```env
OPENAI_API_KEY=sk-...                         # required for embeddings
OPENAI_EMBEDDING_MODEL=text-embedding-3-small # default; change if needed
SHARIAH_DATA_PATH=./data/shariah              # where to read PDFs from
SHARIAH_VECTORSTORE_PATH=./data/shariah-vectorstore  # where to write the FAISS index
```

---

## Step 4 — Run the Ingestion

```bash
cd agents
npm run rag:ingest:shariah
```

Expected output:

```
Found 4 PDF(s) in ./data/shariah
  Loaded 42 pages from aaoifi-standard-8.pdf [AAOIFI-8]
  Loaded 18 pages from aaoifi-standard-28.pdf [AAOIFI-28]
  Loaded 11 pages from aaoifi-standard-40.pdf [AAOIFI-40]
  Loaded 27 pages from cbn-nifi-framework.pdf [CBN]

Split into 412 chunks
Embedding with OpenAI and building FAISS index...

✓ Saved FAISS vector store to ./data/shariah-vectorstore
  412 chunks ready for Shariah compliance queries
```

Ingestion time: approximately 1–3 minutes depending on PDF size and OpenAI API response time.

The output directory `data/shariah-vectorstore/` is git-ignored — it lives only on the machine
that ran the ingestion. Every developer who runs the agent must run this step once.

---

## Step 5 — Start the Shariah MCP Server

```bash
cd agents
npm run mcp:shariah
```

The server starts on stdio and stays running. Keep this terminal open.
The server loads the FAISS index on first query (lazy load) and holds it in memory.

If you see:

```
Error: Shariah vector store not found at .../data/shariah-vectorstore.
Run: npm run rag:ingest:shariah
```

Go back to Step 4 — the ingestion hasn't been run yet.

---

## Step 6 — Verify It Works

Open a separate terminal and test via the `dcode` CLI:

```bash
cd agents
dcode
```

Inside `dcode`:
```
/mcp
```
This shows the `shariah` server is connected and its tools are loaded.

Then invoke a test query:
```
Use query_shariah_ruling to check: SoleProprietorship engaged in halal food retail,
seeking Murabahah financing to purchase inventory (cooking oil, rice, flour).
```

Expected: the server returns AAOIFI passages and the agent returns `COMPLIANT`.

---

## Full Startup Sequence

When running the full Vetify agent stack, start in this order:

```bash
# Terminal 1 — Canton ledger MCP
cd agents && npm run mcp:canton

# Terminal 2 — mono.co MCP
cd agents && npm run mcp:mono

# Terminal 3 — Youverify MCP
cd agents && npm run mcp:youverify

# Terminal 4 — Shariah RAG MCP (requires ingestion to have been run first)
cd agents && npm run mcp:shariah

# Terminal 5 — Supervisor (polls Canton and dispatches agents)
cd agents && npm run dev
```

Or for IDE-integrated (ACP) mode:

```bash
# Terminals 1–4: MCP servers as above
# Terminal 5 — ACP server (exposes agents to VS Code / Zed / JetBrains)
cd agents && npm run acp
```

---

## Updating the Knowledge Base

When AAOIFI publishes an updated standard or the CBN issues a new NIFI circular:

1. Replace or add the PDF in `agents/data/shariah/`
2. Re-run ingestion — it **overwrites** the existing vector store:
   ```bash
   npm run rag:ingest:shariah
   ```
3. Restart the Shariah MCP server (it holds the old index in memory):
   ```bash
   # Ctrl-C the running mcp:shariah process, then:
   npm run mcp:shariah
   ```

No database migrations, no schema changes — just re-ingest and restart.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `No PDF files found in ./data/shariah` | PDFs not placed yet | Place PDFs per Step 2 |
| `Shariah vector store not found` | Ingestion not run | Run `npm run rag:ingest:shariah` |
| `OpenAI API error` during ingestion | Missing or invalid API key | Check `OPENAI_API_KEY` in `.env` |
| Agent returns `NON_COMPLIANT` for everything | Wrong PDFs ingested or poor chunking | Verify PDF text is selectable (not scanned image); re-ingest |
| `FAISS index load error` | Corrupt index or version mismatch | Delete `data/shariah-vectorstore/` and re-ingest |
| Very slow ingestion | Large PDFs + OpenAI rate limits | Normal; wait it out or use batching |

---

## File Reference

| File | Purpose |
|---|---|
| `src/rag/shariah/ingest.ts` | Ingestion script — reads PDFs, chunks, embeds, saves FAISS |
| `src/rag/shariah/retriever.ts` | Lazy-loaded singleton retriever used by MCP server |
| `src/mcp/shariah-server.ts` | MCP server exposing `query_shariah_ruling` and `check_prohibited_sector` |
| `src/agents/shariah.ts` | Shariah Agent — calls MCP server, returns `ShariahResult` |
| `data/shariah/` | Place source PDFs here |
| `data/shariah-vectorstore/` | Generated FAISS index (git-ignored) |
| `skills/shariah/SKILL.md` | Agent skill with 6-step assessment workflow |
| `skills/shariah/references/prohibited-sectors.md` | Hard prohibition rules per AAOIFI Standard No. 28 |
| `skills/shariah/references/aaoifi-standards-index.md` | AAOIFI standard clause index for citations |
