import { CohereRerank } from '@langchain/cohere';

export interface RetrievedDocument {
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface RerankOptions {
  topK?: number;
}

interface RerankedDoc {
  pageContent: string;
  metadata: Record<string, unknown> & { relevanceScore?: number };
}

export async function rerankResults(
  query: string,
  documents: any[],
  options: RerankOptions = {}
): Promise<RetrievedDocument[]> {
  if (!process.env.COHERE_API_KEY) {
    throw new Error('COHERE_API_KEY is required for Cohere re-ranking.');
  }

  const { topK = 5 } = options;

  const reranker = new CohereRerank({
    apiKey: process.env.COHERE_API_KEY,
    topN: topK,
    model: 'rerank-english-v3.0',
  });

  const reranked = (await reranker.compressDocuments(
    documents.map((d) => ({ pageContent: d.content, metadata: d.metadata })),
    query
  )) as RerankedDoc[];
  return reranked.map((doc, i) => {
    const relevanceScore =
      typeof doc.metadata?.relevanceScore === 'number'
        ? doc.metadata.relevanceScore
        : 1 - i * 0.1;

    return {
      content: doc.pageContent,
      metadata: doc.metadata,
      score: relevanceScore,
    };
  });
}
