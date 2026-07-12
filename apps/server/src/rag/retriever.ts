import { createVectorStore } from '../config/providers';

export interface RetrieveOptions {
  topK?: number;
  filter?: Record<string, string>; // e.g., { doc_type: 'runbook' }
  scoreThreshold?: number;
}

export async function retrieveDocuments(
  _query: string,
  _options?: RetrieveOptions
): Promise<unknown[]> {

  // Create vector store
  const vectorStore = await createVectorStore();
  // Perform similarity search
  const { topK = 5, filter, scoreThreshold = 0.7 } = _options || {};

  // Using max marginal Search (MMR) for retrieval, which reduces redundancy but doesn't provide scores
  const results = await vectorStore.maxMarginalRelevanceSearch(_query, {
    k: topK,
    fetchK: topK * 3, // fetch more for re-ranking
    lambda: 0.5, // 0=max diversity, 1=max relevance
    filter,
  });
  // Return retrieved documents with content, metadata, and score with MMR (score is not provided, so use default)
  return results.map((doc) => ({
    content: doc.pageContent,
    metadata: doc.metadata
  }));

}
