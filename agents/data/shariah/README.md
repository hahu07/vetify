# Shariah Knowledge Base — PDF Source Files

Place your AAOIFI and CBN NIFI PDF documents here before running the ingestion script.

## Required Documents

| File (suggested name) | Document | Authority |
|---|---|---|
| `aaoifi-standard-8.pdf` | AAOIFI Shari'a Standard No. 8 — Murabahah | AAOIFI |
| `aaoifi-standard-28.pdf` | AAOIFI Shari'a Standard No. 28 — Prohibited Business Activities | AAOIFI |
| `aaoifi-standard-40.pdf` | AAOIFI Shari'a Standard No. 40 — Distribution of Profit in Islamic Institutions | AAOIFI |
| `cbn-nifi-framework.pdf` | CBN Guidelines for Regulation and Supervision of Non-Interest Financial Institutions | CBN |

## File Naming Convention

The ingest script detects authority and standard from the filename:

- Files containing `cbn` → tagged as `authority: "CBN"`
- All other files → tagged as `authority: "AAOIFI"`
- Files containing `standard-N` (e.g. `standard-8`, `standard-28`) → tagged as `standard: "AAOIFI-8"` etc.

You can add additional PDFs (e.g. IFSB standards, CBN circulars) — the script ingests all `.pdf` files in this directory.

## After placing files

```bash
cd agents
npm run rag:ingest:shariah
```

See `agents/docs/shariah-rag.md` for full setup instructions and troubleshooting.
