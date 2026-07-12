import type {
  AgentState as AgentStateType,
  AgentName,
  Finding,
  ChatMessage,
  CorrelationResult,
} from "@incidentiq/shared-types";
import { MemorySaver, Command, interrupt } from "@langchain/langgraph";
import { getEncoding } from "js-tiktoken";
import { StateGraph } from "@langchain/langgraph";
import { triageAgent, TriageResult } from "./triageAgent";
import { knowledgeAgent } from "./knowledgeAgent";
import { logAgent } from "./logAgent";
import { metricsAgent } from "./metricsAgent";
import { correlationAgent } from "./correlationAgent";
import { rcaAgent } from "./rcaAgent";
import { getCheckPointer } from "../config/providers";
import { incidentState } from "../state";
import type { IncidentStateType } from "../state";
import { inputGuardrailAgent } from "./inputGuardrail";
import { queryRouter } from "./queryRouter";
import { ragNode } from "./ragNode";
import { chatNode } from "./chatNode";
import { summarizerAgent } from "./summarizerAgent";
import { frontendActionAgent } from "./frontendAction";
import { logger } from "../observability";

// export interface OrchestratorInput {
//   message: string;
//   conversationId: string;
//   incidentId?: string;
// }

let orchestrator: ReturnType<typeof stateGraph.compile> | null = null;

export const stateGraph = new StateGraph(incidentState)

  .addNode("inputGuardrail", inputGuardrailAgent)
  .addNode("frontendActionAgent", frontendActionAgent)
  .addNode("summarizer", summarizerAgent)
  .addNode("queryRouter", queryRouter)
  .addNode("ragNode", ragNode)
  .addNode("chatNode", chatNode)

  .addNode("triage", triageAgent)
  .addNode("log-analysis", logAgent)
  .addNode("knowledge", knowledgeAgent)
  .addNode("metrics", metricsAgent)
  .addNode("correlation", correlationAgent)
  .addNode("rca-generator", rcaAgent)

  .addEdge("__start__", "inputGuardrail")
  .addConditionalEdges("inputGuardrail", (state) =>  state.isSafe ? "frontendActionAgent" : "__end__")
  .addConditionalEdges("frontendActionAgent", routeAfterFrontendAction)
  .addEdge("summarizer", "queryRouter" )
  .addConditionalEdges("queryRouter", routeAfterQueryRouter)
  .addEdge("ragNode", "__end__")
  .addEdge("chatNode", "__end__")
  .addConditionalEdges("triage", routeAfterTriage)
  .addEdge("log-analysis", "correlation")
  .addEdge("knowledge", "correlation")
  .addEdge("metrics", "correlation")
  .addEdge("correlation", "rca-generator")
  .addEdge("rca-generator", "__end__");

  

function routeAfterTriage(state: IncidentStateType) {
  return state.agentsToRun; 
}

function routeAfterQueryRouter(state: IncidentStateType) {
 switch(state.queryType) {
    case "rag":
      return "ragNode";
    case "incident":
      return "triage";
    case "common_chat":
      return "chatNode";
    default:
      return "incident";
  }
}

function routeAfterFrontendAction(state: IncidentStateType) {
  // If the last message has tool_calls, the frontend action was triggered — end the graph
  const lastMsg = state.messages[state.messages.length - 1];
  if (state.frontendAction === true) {
    return "__end__";
  }
  // Otherwise continue to normal routing
   if(isSummarizerRequired(state)) {
    return "summarizer";
   }
   return "queryRouter";
}

export function isSummarizerRequired(_state: IncidentStateType): boolean {
  const encoder = getEncoding("cl100k_base"); // works for GPT-4, close enough for others
  const totalTokens = _state.messages.reduce(
    (sum, m: any) => sum + encoder.encode(String(m.content)).length,
    0,
  );
  if (totalTokens < 3000) {
    return false; // No need to summarize if the conversation is short
  }
  return true;
}

export async function getOrchestrator() {
  if (!orchestrator) {
    const checkpointer = await getCheckPointer();
    orchestrator = stateGraph.compile({ checkpointer });
  }
  return orchestrator;
}
