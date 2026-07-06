/**
 * One-time ingestion script — run after placing PDFs in agents/data/shariah/
 *
 *   npm run rag:ingest:shariah
 *
 * Loads all PDFs, chunks them, embeds with OpenAI, and saves a FAISS index
 * to agents/data/shariah-vectorstore/ for use by the Shariah MCP server.
 */
import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { readdirSync } from "fs";
import path from "path";

const DATA_DIR  = process.env.SHARIAH_DATA_PATH       ?? "./data/shariah";
const STORE_DIR = process.env.SHARIAH_VECTORSTORE_PATH ?? "./data/shariah-vectorstore";

async function ingest() {
  const pdfFiles = readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith(".pdf"));

  if (pdfFiles.length === 0) {
    console.error(`No PDF files found in ${DATA_DIR}`);
    console.error("Place your AAOIFI and CBN NIFI PDF documents there and re-run.");
    process.exit(1);
  }

  console.log(`Found ${pdfFiles.length} PDF(s) in ${DATA_DIR}`);

  const allDocs = [];

  for (const file of pdfFiles) {
    const filePath = path.join(DATA_DIR, file);
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    const nameLower = file.toLowerCase();
    const authority = nameLower.includes("cbn") ? "CBN" : "AAOIFI";

    // Extract standard number from filename, e.g. "aaoifi-standard-8.pdf" → "AAOIFI-8"
    const stdMatch = nameLower.match(/standard[- _]?(\d+)/);
    const standard = stdMatch ? `${authority}-${stdMatch[1]}` : authority;

    for (const doc of docs) {
      doc.metadata.source    = file;
      doc.metadata.authority = authority;
      doc.metadata.standard  = standard;
    }

    allDocs.push(...docs);
    console.log(`  Loaded ${docs.length} pages from ${file} [${standard}]`);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const splits = await splitter.splitDocuments(allDocs);
  console.log(`\nSplit into ${splits.length} chunks`);

  console.log("Embedding with OpenAI and building FAISS index...");

  const embeddings = new OpenAIEmbeddings({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  });

  const vectorstore = await FaissStore.fromDocuments(splits, embeddings);
  await vectorstore.save(STORE_DIR);

  console.log(`\n✓ Saved FAISS vector store to ${STORE_DIR}`);
  console.log(`  ${splits.length} chunks ready for Shariah compliance queries`);
}

ingest().catch(err => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
