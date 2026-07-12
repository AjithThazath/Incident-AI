import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createVectorStore, createRecordManager } from "../config/providers";
import { index } from "@langchain/core/indexing";
import { logger } from "../observability";

/** Recursively load all .md and .txt files from a directory as Documents */
function loadDirectory(dir: string): Document[] {
  const docs: Document[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      docs.push(...loadDirectory(fullPath));
    } else if (['.md', '.txt'].includes(extname(entry))) {
      docs.push(new Document({
        pageContent: readFileSync(fullPath, 'utf-8'),
        metadata: { source: fullPath },
      }));
    }
  }
  return docs;
}

export async function ingestDocuments(_docsDir: string): Promise<void> {
  //  Load documents
  const docs = loadDirectory(_docsDir);

  //  Split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000, // Characters per chunk
    chunkOverlap: 200, // Overlap between chunks for context continuity
    separators: ["\n## ", "\n### ", "\n\n", "\n", " "], // Markdown-aware splitting
  });
  const chunks = await splitter.splitDocuments(docs);

  //  Add metadata
  for (const chunk of chunks) {
    chunk.metadata.doc_type = inferDocType(chunk.metadata.source);
    chunk.metadata.ingested_at = new Date().toISOString();
  }


  // Setup record manager for idempotent upsert
  const recordManager = createRecordManager("rag/documents"); // unique namespace for this collection
  await recordManager.createSchema(); // creates the tracking table (safe to call every time)
  const vectorStore = await createVectorStore();
  let result;
  try {
    result = await index({
      docsSource: chunks,
      recordManager,
      vectorStore,
      options: {
        cleanup: "full", // deletes vectors for docs no longer in docsSource
        sourceIdKey: "source", // matches chunk.metadata.source set by DirectoryLoader
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error indexing documents: ${message}`);
    throw error;
  }
  logger.info(
    `Indexed: ${result.numAdded} added, ${result.numSkipped} skipped, ${result.numDeleted} deleted`,
  );
}

function inferDocType(source: string): string {
  if (source.includes("runbook")) return "runbook";
  if (source.includes("postmortem") || source.includes("post-mortem"))
    return "postmortem";
  if (source.includes("architecture")) return "architecture";
  return "general";
}

export async function ingestFactsToKnowledgeBase(
  conversationId: string,
  facts: string[],
  context: string[]
) {

  const recordManager = createRecordManager("rag/facts");
  recordManager.createSchema(); // creates the tracking table (safe to call every time)
  const vectorStore = await createVectorStore();

  const docs = [
    ...facts.map((fact: string, i: number) => new Document ({
      pageContent: fact,
      metadata: {
        source: `${conversationId}/fact/${i}`,
        conversationId,
        memoryType: "fact",
        ingested_at: new Date().toISOString(),
      },
    })),
    ...context.map((ctx: string, i: number) => new Document ({
      pageContent: ctx,
      metadata: {
        source: `${conversationId}/context/${i}`,
        conversationId,
        memoryType: "context",
        ingested_at: new Date().toISOString(),
      },
    })),
  ];

  const result = await index({
    docsSource: docs,
    recordManager,
    vectorStore,
    options: {
      cleanup: "incremental", // deletes vectors for docs no longer in docsSource
      sourceIdKey: "source", // matches chunk.metadata.source set by DirectoryLoader
    },
  });

}
