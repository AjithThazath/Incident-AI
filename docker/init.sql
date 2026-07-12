-- Initialize PostgreSQL with pgvector extension and base schema
-- This runs automatically when the postgres container starts for the first time.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Document embeddings table (for RAG)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding vector(768),
    source TEXT,
    doc_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
    ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_doc_type
    ON document_embeddings (doc_type);

-- ---------------------------------------------------------------------------
-- Incidents table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('P1', 'P2', 'P3', 'P4')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved', 'closed')),
    affected_services TEXT[] DEFAULT '{}',
    root_cause TEXT,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- Service metrics (from data/metrics/metrics.csv)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_metrics (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMP WITH TIME ZONE NOT NULL,
    service     TEXT NOT NULL,
    cpu_pct     REAL NOT NULL,
    memory_pct  REAL NOT NULL,
    error_rate  REAL NOT NULL,
    latency_p99 REAL NOT NULL,
    request_count INTEGER NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'normal'
);

CREATE INDEX IF NOT EXISTS idx_service_metrics_service_ts
    ON service_metrics (service, timestamp DESC);


