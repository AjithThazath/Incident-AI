import z from "zod";
import type { IncidentStateType } from "../state";
import { createLLM } from "../config/providers";
import { logger } from "../observability";
import { AgentStatus } from "@incidentiq/shared-types";
import { AIMessage } from "@langchain/core/messages";
import { formatAgentError } from "../middleware/errorHandler";

const queryRouterSchema = z.object({
  queryType: z
    .enum(["rag", "incident", "common_chat"])
    .describe(
      "The route to take based on the user query. 'rag' means to search knowledge base, 'incident' means to analyze and triage incident, 'common_chat' means to respond with a general chat response.",
    ),
});

interface queryRouterResult {
  queryType: "rag" | "incident" | "common_chat";
  triageAgentStatus: AgentStatus;
  logAgentStatus: AgentStatus;
  knowledgeAgentStatus: AgentStatus;
  metricsAgentStatus: AgentStatus;
  correlationAgentStatus: AgentStatus;
  rcaAgentStatus: AgentStatus;
  messages?: any[];
  agentErrors?: {
    agentName: string;
    errorCode: number;
    message: string;
    stack?: string;
  }[];
}

export async function queryRouter(_state: IncidentStateType): Promise<any> {
  try {
    const llm = createLLM();
    const prompt = `You are query router expert. Given the conversation history and user query, determine how to answer it.
    If the query is a follow-up question about a previous response (e.g., asking for details from prior analysis), route to common_chat.
    If the query is requesting NEW incident analysis or reporting a NEW system issue, route to incident.
    If the query is related to searching runbooks or documentation, route to knowledge.
    For other casual or follow-up queries, route it to common_chat.
    
    Previous conversation:
    ${_state.messages.map((m: any) => `${m._getType?.() || m.role}: ${String(m.content).slice(0, 200)}`).join("\n")}
    
    Current user query: ${_state.userMessage}`;

    const result = await llm
      .withStructuredOutput(queryRouterSchema)
      .invoke(prompt, { metadata: { "emit-messages": false } });
    let res: queryRouterResult = {
      queryType: result.queryType,
      triageAgentStatus:
      result.queryType === "incident" ? "running" : "skipped",
      logAgentStatus: "skipped",
      knowledgeAgentStatus: "skipped",
      metricsAgentStatus: "skipped",
      correlationAgentStatus: "skipped",
      rcaAgentStatus: "skipped",
    };
    logger.info(`:::: Query Router result for incident ${_state.incidentId} :::: ${JSON.stringify(res)}`);
    return res;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error in queryRouter:", err);
    return {
      queryType: "incident",
      triageAgentStatus: "running",
      logAgentStatus: "skipped",
      knowledgeAgentStatus: "skipped",
      metricsAgentStatus: "skipped",
      correlationAgentStatus: "skipped",
      rcaAgentStatus: "skipped",
      messages: [ new AIMessage(formatAgentError("Query Router", err.message)) ] 
    };
  }
}
