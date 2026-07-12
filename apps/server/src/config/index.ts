import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function env(key: string, defaultValue = ''): string {
  return process.env[key] || defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

function envFloat(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseFloat(val) : defaultValue;
}

function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (!val) return defaultValue;
  return val === 'true' || val === '1';
}

export const config = {
  // ---------------------------------------------------------------------------
  // LLM Configuration
  // Supported providers: openai | ollama | azure | huggingface | anthropic
  // ---------------------------------------------------------------------------
  llm: {
    provider: env('LLM_PROVIDER', 'openai'),
    model: env('LLM_MODEL', 'gpt-4o'),
    apiKey: env('LLM_API_KEY'),
    baseUrl: env('LLM_BASE_URL'),
    temperature: envFloat('LLM_TEMPERATURE', 0.1),
    maxTokens: envInt('LLM_MAX_TOKENS', 4096),
  },

  classifierModel: {
    provider: env('LLM_CLASSIFIER_MODEL', 'groq'),
    model: env('LLM_CLASSIFIER_MODEL_NAME', 'llama-3.1-8b-instant'),
    apiKey: env('LLM_CLASSIFIER_MODEL_API_KEY'),
  },

  // ---------------------------------------------------------------------------
  // Azure OpenAI (when LLM_PROVIDER=azure)
  // ---------------------------------------------------------------------------
  azure: {
    endpoint: env('AZURE_OPENAI_ENDPOINT'),
    apiKey: env('AZURE_OPENAI_API_KEY'),
    deployment: env('AZURE_OPENAI_DEPLOYMENT'),
    apiVersion: env('AZURE_OPENAI_API_VERSION', '2024-02-15-preview'),
  },

  // ---------------------------------------------------------------------------
  // Ollama (when LLM_PROVIDER=ollama)
  // ---------------------------------------------------------------------------
  ollama: {
    baseUrl: env('OLLAMA_BASE_URL', 'http://localhost:11434'),
    model: env('OLLAMA_MODEL', 'llama3.1'),
  },

  // ---------------------------------------------------------------------------
  // Embedding Configuration
  // Supported: openai | huggingface | ollama
  // ---------------------------------------------------------------------------
  embeddings: {
    provider: env('EMBEDDING_PROVIDER', 'openai'),
    model: env('EMBEDDING_MODEL', 'text-embedding-3-small'),
    dimensions: envInt('EMBEDDING_DIMENSIONS', 1536),
  },

  // ---------------------------------------------------------------------------
  // Vector Store Configuration
  // Supported: pgvector | pinecone | chroma
  // ---------------------------------------------------------------------------
  vectorStore: {
    provider: env('VECTOR_STORE_PROVIDER', 'pgvector'),
    // pgvector
    url: env('VECTOR_STORE_URL', 'postgresql://postgres:postgres@localhost:5432/incidentiq'),
    table: env('VECTOR_STORE_TABLE', 'document_embeddings'),
    dimensions: envInt('VECTOR_STORE_DIMENSIONS', 1536),
    // Pinecone
    pineconeApiKey: env('PINECONE_API_KEY'),
    pineconeIndex: env('PINECONE_INDEX', 'incidentiq'),
    pineconeEnvironment: env('PINECONE_ENVIRONMENT', 'us-east-1'),
    // Chroma
    chromaUrl: env('CHROMA_URL', 'http://localhost:8000'),
    chromaCollection: env('CHROMA_COLLECTION', 'incidentiq'),
  },

  // ---------------------------------------------------------------------------
  // Database Configuration
  // ---------------------------------------------------------------------------
  database: {
    url: env('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/incidentiq'),
  },

  // ---------------------------------------------------------------------------
  // Redis Configuration
  // ---------------------------------------------------------------------------
  redis: {
    url: env('REDIS_URL', 'redis://localhost:6379'),
  },

  // ---------------------------------------------------------------------------
  // HuggingFace Configuration
  // ---------------------------------------------------------------------------
  huggingface: {
    apiKey: env('HF_API_KEY'),
    inferenceUrl: env('HF_INFERENCE_URL', 'https://api-inference.huggingface.co'),
  },

  // ---------------------------------------------------------------------------
  // Python ML Service
  // ---------------------------------------------------------------------------
  mlService: {
    url: env('ML_SERVICE_URL', 'http://localhost:8000'),
  },

  // ---------------------------------------------------------------------------
  // Server Configuration
  // ---------------------------------------------------------------------------
  server: {
    port: envInt('SERVER_PORT', 3001),
    host: env('SERVER_HOST', '0.0.0.0'),
    corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),
    nodeEnv: env('NODE_ENV', 'development'),
  },

  // ---------------------------------------------------------------------------
  // Observability
  // ---------------------------------------------------------------------------
  observability: {
    langsmithEnabled: envBool('LANGCHAIN_TRACING_V2', false),
    LANGSMITH_API_KEY: env('LANGCHAIN_API_KEY'),
    langsmithProject: env('LANGCHAIN_PROJECT', 'incidentiq-ai'),
    logLevel: env('LOG_LEVEL', 'info'),
  },

  // ---------------------------------------------------------------------------
  // Feature Flags
  // ---------------------------------------------------------------------------
  features: {
    humanInTheLoop: envBool('FEATURE_HUMAN_IN_LOOP', true),
    caching: envBool('FEATURE_CACHING', true),
    guardrails: envBool('FEATURE_GUARDRAILS', true),
  },

  // ---------------------------------------------------------------------------
  // MCP Server Configuration (Streamable HTTP)
  // Runs as a standalone HTTP server on MCP_PORT exposing a single /mcp endpoint.
  // Supports POST (JSON-RPC), GET (SSE stream), DELETE (session termination).
  // ---------------------------------------------------------------------------
  mcp: {
    port: envInt('MCP_PORT', 3002),
    endpoint: env('MCP_ENDPOINT', '/mcp'),
  },

  // ---------------------------------------------------------------------------
  // Data paths
  // ---------------------------------------------------------------------------
  data: {
    baseDir: env('MOCK_DATA_OUTPUT_DIR', path.resolve(__dirname, '../../../../data')),
  },

  // ---------------------------------------------------------------------------
  // Cohere Configuration
  // ---------------------------------------------------------------------------
  
  cohere: {
    apiKey: env('COHERE_API_KEY'),
  },
  COPILOTKIT_TELEMETRY_DISABLED: envBool('COPILOTKIT_TELEMETRY_DISABLED', true),
  API_BASE_URL: env('API_BASE_URL', 'http://localhost:3001'),

} as const;

export type Config = typeof config;
export default config;
