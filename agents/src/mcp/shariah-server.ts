/**
 * Shariah Knowledge MCP Server
 *
 * Exposes the AAOIFI/CBN NIFI vector store as an MCP tool.
 * Run with: npm run mcp:shariah
 * Requires: OPENAI_API_KEY, data ingested via npm run rag:ingest:shariah
 */
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "path";
import { existsSync } from "fs";

const STORE_DIR = path.resolve(
  process.env.SHARIAH_VECTORSTORE_PATH ?? "./data/shariah-vectorstore"
);

const server = new McpServer({
  name: "shariah-knowledge",
  version: "0.1.0",
});

let _store: FaissStore | null = null;

async function getStore(): Promise<FaissStore> {
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
  return _store;
}

server.registerTool(
  "query_shariah_ruling",
  {
    description:
      "Query the AAOIFI Shari'a Standards and CBN NIFI Framework knowledge base " +
      "to retrieve relevant passages for assessing whether a business activity " +
      "or Murabahah financing purpose is permissible under Islamic finance principles.",
    inputSchema: z.object({
      businessType: z
        .string()
        .describe("Business type, e.g. 'SoleProprietorship' or 'LimitedCompany'"),
      businessActivity: z
        .string()
        .describe("Description of the primary business activities"),
      financingPurpose: z
        .string()
        .describe("Stated purpose of the Murabahah financing request"),
    }),
  },
  async ({ businessType, businessActivity, financingPurpose }) => {
    const store = await getStore();

    const query =
      `Islamic finance Murabahah permissibility: ${businessType} ` +
      `engaged in ${businessActivity}, seeking financing for ${financingPurpose}. ` +
      `Is this halal? AAOIFI standard prohibited sectors riba gharar maysir.`;

    const results = await store.similaritySearchWithScore(query, 6);

    const passages = results.map(([doc, score]) => ({
      source:    doc.metadata.source    as string,
      authority: doc.metadata.authority as string,
      standard:  doc.metadata.standard  as string,
      page:      doc.metadata.page      as number,
      relevance: Math.round(score * 1000) / 1000,
      content:   doc.pageContent,
    }));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ query, passages }, null, 2),
      }],
    };
  }
);

server.registerTool(
  "check_prohibited_sector",
  {
    description:
      "Check whether a specific business sector or activity appears in the " +
      "AAOIFI prohibited sectors list (Standard No. 28) or CBN NIFI excluded categories.",
    inputSchema: z.object({
      sector: z.string().describe("Business sector or activity to check"),
    }),
  },
  async ({ sector }) => {
    const store = await getStore();

    const query =
      `${sector} prohibited haram forbidden not permissible Islamic finance ` +
      `AAOIFI Standard 28 prohibited business activities alcohol gambling tobacco riba`;

    const results = await store.similaritySearchWithScore(query, 4);

    const passages = results.map(([doc, score]) => ({
      source:    doc.metadata.source    as string,
      authority: doc.metadata.authority as string,
      standard:  doc.metadata.standard  as string,
      page:      doc.metadata.page      as number,
      relevance: Math.round(score * 1000) / 1000,
      content:   doc.pageContent,
    }));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ sector, passages }, null, 2),
      }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
