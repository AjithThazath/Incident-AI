import { config } from "./index";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { Pool } from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ChatGroq } from "@langchain/groq";
import { PostgresRecordManager } from "@langchain/community/indexes/postgres";
import { logger } from "../observability";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

let _llmMmodel: any;
let _classifierModel: any;
let _embeddingModel: any;
let _vectorStore: any;
let _redisClient: any;
let _pool: Pool | null = null;
let _checkpointer: PostgresSaver | null = null;
let _recordManager: PostgresRecordManager | null = null;


function getNormalizedOllamaBaseUrl(): string {
  const rawBaseUrl = config.ollama.baseUrl;
  try {
    const parsed = new URL(rawBaseUrl);

    if (parsed.protocol === "https:" && parsed.port === "11434") {
      parsed.protocol = "http:";
      logger.warn(
        "OLLAMA_BASE_URL used https on port 11434; falling back to http.",
      );
    }

    if (parsed.pathname === "/v1" || parsed.pathname.startsWith("/v1/")) {
      parsed.pathname = "";
      parsed.search = "";
      parsed.hash = "";
      logger.warn(
        "OLLAMA_BASE_URL included /v1; using base root URL for Ollama APIs.",
      );
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return rawBaseUrl;
  }
}

export function createLLM(): ChatOpenAI {
  // TODO: Implement based on config.llm.provider
  if (_llmMmodel) return _llmMmodel;

  switch (config.llm.provider) {
    case "openai":
      _llmMmodel = new ChatOpenAI({
        modelName: config.llm.model,
        openAIApiKey: config.llm.apiKey,
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens,
      });
      break;

    case "ollama":
      _llmMmodel = new ChatOllama({
        baseUrl: getNormalizedOllamaBaseUrl(),
        model: config.ollama.model,
        temperature: config.llm.temperature,
        numCtx: 4096,
        keepAlive: "5m",
      } as any);
      break;

    case "huggingface":
      _llmMmodel = new ChatOpenAI({
        modelName: config.llm.model,
        apiKey: config.huggingface.apiKey,
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens,
        configuration: {
          baseURL: "https://router.huggingface.co/v1"
        },
      });
      break;

    case "groq":
      _llmMmodel = new ChatGroq({
        model: config.llm.model,
        apiKey: config.llm.apiKey,
        temperature: config.llm.temperature,
        streaming: true,
      });
      break;

    default:
      throw new Error(
        `LLM provider "${config.llm.provider}" not supported. See createLLM() for supported providers.`,
      );
  }
  return _llmMmodel;
}

export function createClassifierModel(): ChatOpenAI {
  if (_classifierModel) return _classifierModel;
  switch (config.classifierModel.provider) {
    case 'groq':
      _classifierModel = new ChatGroq({
        model: config.classifierModel.model,
        apiKey: config.classifierModel.apiKey,
        temperature: config.llm.temperature,
        streaming: true,
      });
      break;
    default:
      throw new Error(
        `Classifier model provider "${config.classifierModel.provider}" not supported.`,
      );
  }
  return _classifierModel;
}

export function createEmbeddings(): OpenAIEmbeddings {
  if (_embeddingModel) return _embeddingModel;
  switch (config.embeddings.provider) {
    case "openai":
      _embeddingModel = new OpenAIEmbeddings({
        modelName: config.embeddings.model,
        openAIApiKey: config.llm.apiKey,
        dimensions: config.embeddings.dimensions,
      });
      break;

    case "ollama":
      _embeddingModel = new OllamaEmbeddings({
        model: config.embeddings.model,
        baseUrl: config.ollama.baseUrl,
      });
      break;
    case 'huggingface':
      _embeddingModel = new HuggingFaceInferenceEmbeddings({
        model: config.embeddings.model,
        apiKey: config.huggingface.apiKey,
      })
  }
  return _embeddingModel;
}

export async function createVectorStore(): Promise<PGVectorStore> {
  const embeddings = createEmbeddings();
  if (_vectorStore) return _vectorStore;
  switch (config.vectorStore.provider) {
    case "pgvector":
      _vectorStore = await PGVectorStore.initialize(embeddings, {
        postgresConnectionOptions: { connectionString: config.vectorStore.url },
        tableName: config.vectorStore.table,
        columns: {
          contentColumnName: "content",
          metadataColumnName: "metadata",
          vectorColumnName: "embedding",
        },
      });
      break;
    default:
      throw new Error(
        `Vector store provider "${config.vectorStore.provider}" not supported.`,
      );
  }
  return _vectorStore;
}

// ---------------------------------------------------------------------------
// Database Pool
// ---------------------------------------------------------------------------
// Returns a shared pg.Pool connected to DATABASE_URL.
// One pool per process — call getPool() everywhere instead of new Pool().

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: config.database.url });
  }
  return _pool;
}

export async function getCheckPointer() {
  if (_checkpointer) return _checkpointer;
  _checkpointer = PostgresSaver.fromConnString(config.database.url);
  await _checkpointer.setup();
  return _checkpointer;
}

export async function getRedisClient() {
  if (!_redisClient) {
    const { createClient } = await import("redis");
    _redisClient = createClient({ url: config.redis.url });
    await _redisClient.connect();
  }
  return _redisClient;
}

export function createRecordManager(namespace: string): PostgresRecordManager {
  if (_recordManager) return _recordManager;
  _recordManager = new PostgresRecordManager(namespace, {
    postgresConnectionOptions: {
      connectionString: config.vectorStore.url,
    },
  });
  return _recordManager;
}
