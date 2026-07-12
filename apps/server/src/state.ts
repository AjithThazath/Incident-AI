import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { AgentName, AgentStatus, CorrelationResult, Finding } from "@incidentiq/shared-types";


export const incidentState = Annotation.Root({
  userMessage: Annotation<string>({ reducer: (_, b) => b }),
  conversationId: Annotation<string>(),
  incidentId: Annotation<string | null>(),
  triageAgentStatus: Annotation<AgentStatus>({ reducer: (_, b) => b }),
  logAgentStatus: Annotation<AgentStatus>({ reducer: (_, b) => b }),
  knowledgeAgentStatus: Annotation<AgentStatus>({ reducer: (_, b) => b }),
  metricsAgentStatus: Annotation<AgentStatus>({ reducer: (_, b) => b }),
  correlationAgentStatus: Annotation<AgentStatus>({ reducer: (_, b) => b }),
  rcaAgentStatus: Annotation<AgentStatus>({ reducer: (_, b) => b }),

  isSafe: Annotation<boolean>({ default: () => false, reducer: (_, b) => b }),
  queryType: Annotation<"rag" | "incident" | "common_chat" | null>({
    default: () => null,
    reducer: (_, b) => b,
  }),
  copilotkit: Annotation<any>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  triageResult: Annotation<any>({
    reducer: (_, b) => b,
    default: () => ({}),
  }),
  logFindings: Annotation<Finding[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  knowledgeFindings: Annotation<Finding[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  metricFindings: Annotation<Finding[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  correlations: Annotation<CorrelationResult[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  rca: Annotation<string | null>({ default: () => null, reducer: (_, b) => b }),
  agentErrors : Annotation<{agentName: string, errorCode: number, message: string, stack?: string}[]>({
    default: () => [],
    reducer: (a, b) => (Array.isArray(b) && b.length === 0 ? [] : [...a, ...b]),
  }),
  conversationSummary: Annotation<string | null>({
    default: () => null,
    reducer: (_, b) => b,
  }),

  frontendAction: Annotation<boolean>({ default: () => false, reducer: (_, b) => b }),

  currentAgent: Annotation<AgentName>({
    reducer: (_, b) => b,
    default: () => "triage" as AgentName,
  }),
  agentsToRun: Annotation<AgentName[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),

  ...MessagesAnnotation.spec,
});

export type IncidentStateType = typeof incidentState.State;