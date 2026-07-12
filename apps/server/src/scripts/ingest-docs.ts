import path from 'path';
import { ingestDocuments } from '../rag/ingest';
import { logger } from '../observability';

async function main(): Promise<void> {
  const cliPath = process.argv[2];
  const envPath = process.env.RAG_DOCS_DIR;
  const docsDir = path.resolve(process.cwd(), cliPath ?? envPath ?? 'data/runbooks');
  await ingestDocuments(docsDir);
}

main()
  .then(() => {
    logger.info('Document ingestion complete.');
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error('Document ingestion failed:', error);
    process.exit(1);
  });
