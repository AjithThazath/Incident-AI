# IncidentIQ AI

> Multimodal IT Incident Intelligence & Root Cause Analysis Platform

IncidentIQ AI is a production-grade AI engineering portfolio project that ingests multimodal incident evidence (logs, runbook documents, and metric time-series), auto-triages, correlates signals across data types, and generates draft Root Cause Analyses (RCAs).

---

## Architecture Overview

```
┌────────────┐     ┌──────────────────────────────────────────────┐
│  React UI  │────▶│  Node.js Server (Express + TypeScript)       │
│  (Vite)    │◀────│  ┌─────────────────────────────────────────┐ │
└────────────┘ SSE │  │  LangGraph Agent Orchestrator            ││
                   │  │  ┌──────────┐ ┌──────────┐               ││
                   │  │  │ Triage   │ │ Log      │               ||  
                   │  │  │ Agent    │ │ Agent    │               |│
                   │  │  └──────────┘ └──────────┘               ||
                   │  │  ┌──────────┐              ┌──────────┐  |│
                   │  │  │Knowledge │              │ Metrics  │  |│
                   │  │  │ Agent    │              │ Agent    │  |│
                   │  │  └──────────┘              └──────────┘  |│
                   │  │  ┌──────────┐ ┌──────────┐               |│
                   │  │  │Correlate │ │ RCA      │               |│
                   │  │  │ Agent    │ │ Agent    │               |│
                   │  │  └──────────┘ └──────────┘               |│
                   │  └─────────────────────────────────────────┘ │
                   │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
                   │  │ RAG      │ │ Memory   │ │ Guardrails   │  │
                   │  │ Pipeline │ │ Store    │ │ & Cache      │  │
                   │  └──────────┘ └──────────┘ └──────────────┘  │
                   └──────────┬───────────────────────────────────┘
                              │                       
                   ┌──────────▼──────┐ 
                   │  PostgreSQL     │   
                   │  + pgvector     │   
                   │                 │   
                   └─────────────────┘   
```

## Monorepo Structure (Nx)

```
incidentiq-ai/
├── apps/
│   ├── server/          ← Node.js + TypeScript (Express, LangChain, LangGraph)
│   ├── web/             ← React + TypeScript (Vite) — FULLY IMPLEMENTED
│   └── ml-service/      ← Python FastAPI (NER, Tabular ML, Eval)
├── libs/
│   └── shared-types/    ← TypeScript types shared between server & web
├── scripts/             ← Mock data generation (Python, self-contained)
├── data/                ← Generated mock data output
├── docker/              ← Database init scripts
├── commands.md          ← Setup & command reference
├── development.md       ← Phased learning roadmap
└── .env.example         ← All configuration (models, databases, providers)
```

## Key AI Concepts Demonstrated

| Concept | Location | Description |
|---------|----------|-------------|
| **RAG** | `apps/server/src/rag/` | Retrieval-Augmented Generation with pgvector |
| **Multi-Agent Orchestration** | `apps/server/src/agents/` | LangGraph state machine with 8 specialized agents |
| **Human-in-the-Loop** | `apps/server/src/agents/triageAgent.ts` | Agents ask users clarifying questions |
| **Tool Use** | `apps/server/src/agents/tools.ts` | Custom tools for log search, metric query, etc. |
| **Memory**    | Using langchain checkpointer | Conversation summarization & context management |
| **Guardrails** | `apps/server/src/guardrails/` | Input/output validation, hallucination detection |
| **Caching** | `apps/server/src/cache/` | Redis-based LLM response & embedding cache |

## Configuration

**All model, database, and provider settings live in `.env`**. To switch providers:

```bash
# Switch from OpenAI to Ollama (local)
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434

# Switch vector store from pgvector to Pinecone
VECTOR_STORE_PROVIDER=pinecone
PINECONE_API_KEY=your-key
PINECONE_INDEX=incidentiq

# Switch embeddings to HuggingFace
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=BAAI/bge-large-en-v1.5
```

See [.env.example](.env.example) for all available options.

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> incidentiq-ai
cd incidentiq-ai
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 5. Run the app
npm run dev:all
```
