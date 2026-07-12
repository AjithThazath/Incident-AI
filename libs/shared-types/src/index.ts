// =============================================================================
// IncidentIQ AI — Shared Types
// =============================================================================
// Types shared between the Node.js server and React frontend.
// Import as: import { Incident, ChatMessage, ... } from '@incidentiq/shared-types';
// =============================================================================

// ---------------------------------------------------------------------------
// Incident Types
// ---------------------------------------------------------------------------

export type Severity = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  incidentId: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  affectedServices: string[];
  rootCause: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
}


export interface IncidentEvent {
  id: string;
  incidentId: string;
  eventType: string;
  agentName: string | null;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IncidentSummary {
  totalOpen: number;
  totalP1: number;
  totalP2: number;
  avgMttr: number; // minutes
  recentIncidents: Incident[];
}

// ---------------------------------------------------------------------------
// Chat & Conversation Types
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'feedback_request';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  agentName: string | null;
  metadata: MessageMetadata;
  createdAt: string;
}

export interface MessageMetadata {
  /** Which agent generated this message */
  agent?: string;
  /** Tool calls made by the agent */
  toolCalls?: ToolCallInfo[];
  /** Sources cited (for RAG) */
  sources?: Source[];
  /** If role is 'feedback_request', these are the options */
  feedbackOptions?: FeedbackOption[];
  /** Thinking/reasoning trace */
  thinking?: string;
  /** Processing time in ms */
  processingTime?: number;
}

export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface Source {
  title: string;
  content: string;
  score: number;
  docType: string;
}

export interface FeedbackOption {
  id: string;
  label: string;
  description?: string;
}

export interface Conversation {
  id: string;
  incidentId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Agent Types
// ---------------------------------------------------------------------------

export type AgentName =
  | 'triage'
  | 'log-analysis'
  | 'visual-analysis'
  | 'knowledge'
  | 'audio-analysis'
  | 'metrics'
  | 'correlation'
  | 'rca-generator'
  | 'human-feedback';

export type AgentStatus = 'skipped' | 'pending' | 'running'  | 'completed' | 'error';

export interface AgentState {
  name: AgentName;
  status: AgentStatus;
  currentTask: string | null;
  findings: Finding[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface Correlation {
  id: string;
  description: string;
  causalChain: string[];
  relatedFindings: string[];
  confidence: number;
  rootCause: boolean;
  explanation: string;
}

export interface CorrelationResult {
  correlations: Correlation[];
  primaryRootCause: string | null;
  overallConfidence: number;
  needsHumanInput: boolean;
  clarificationQuestion: string | null;
}

export interface Finding {
  id: string;
  agentName: AgentName;
  type: 'anomaly' | 'error' | 'warning' | 'info' | 'correlation';
  title: string;
  description: string;
  confidence: number; // 0-1
  evidence: Evidence[];
  timestamp: string;
}

export interface Evidence {
  type: 'log_line' | 'metric' | 'screenshot' | 'document' | 'audio_transcript';
  content: string;
  source: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API Request/Response Types
// ---------------------------------------------------------------------------

export interface ChatRequest {
  message: string;
  conversationId?: string;
  incidentId?: string;
  /** Attachments: base64 encoded files */
  attachments?: Attachment[];
  /** Response to a feedback request */
  feedbackResponse?: {
    requestId: string;
    selectedOption?: string;
    freeText?: string;
  };
}

export interface Attachment {
  filename: string;
  mimeType: string;
  data: string; // base64
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  agentStates: AgentState[];
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  services: {
    database: boolean;
    redis: boolean;
    mlService: boolean;
    llm: boolean;
  };
}

// ---------------------------------------------------------------------------
// SSE Event Types (Server-Sent Events for streaming)
// ---------------------------------------------------------------------------

export type SSEEventType =
  | 'agent_started'
  | 'agent_completed'
  | 'agent_error'
  | 'finding'
  | 'message'
  | 'feedback_request'
  | 'thinking'
  | 'done';

export interface SSEEvent {
  type: SSEEventType;
  data: AgentState | Finding | ChatMessage | { content: string };
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Configuration Types (for Settings UI)
// ---------------------------------------------------------------------------

export interface AppConfig {
  llm: {
    provider: string;
    model: string;
    temperature: number;
  };
  embeddings: {
    provider: string;
    model: string;
  };
  vectorStore: {
    provider: string;
  };
  features: {
    humanInTheLoop: boolean;
    caching: boolean;
    guardrails: boolean;
    tracing: boolean;
  };
}

// ---------------------------------------------------------------------------
// Evaluation Types
// ---------------------------------------------------------------------------

export interface EvalResult {
  runId: string;
  incidentId: string;
  metrics: Record<string, number>;
  createdAt: string;
}

export interface EvalSummary {
  totalRuns: number;
  avgMetrics: Record<string, number>;
  lastRunAt: string;
}
