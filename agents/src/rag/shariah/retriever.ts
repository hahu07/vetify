import "dotenv/config";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "path";
import { existsSync } from "fs";

const STORE_DIR = path.resolve(
  process.env.SHARIAH_VECTORSTORE_PATH ?? "./data/shariah-vectorstore"
);

let _store: FaissStore | null = null;

export async function getShariahRetriever() {
  if (!existsSync(STORE_DIR)) {
    throw new Error(
      `Shariah vector store not found at ${STORE_DIR}. ` +
      "Run: npm run rag:ingest:shariah"
    );
  }

  if (!_store) {
    const embeddings = new OpenAIEmbeddings({
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    });
    _store = await FaissStore.load(STORE_DIR, embeddings);
  }

  return _store.asRetriever({ k: 6 });
}

export async function queryShariahKnowledge(query: string) {
  const retriever = await getShariahRetriever();
  return retriever.invoke(query);
}
