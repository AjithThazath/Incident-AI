import { Finding } from "@incidentiq/shared-types";
import { createLLM } from "../config/providers";
import { retrieveDocuments } from "../rag/retriever";
import z from "zod";
import { getFromCache, setInCache } from "../cache";
import { rerankResults } from "../rag/reranker";
import { logger } from "../observability";

export async function knowledgeAgent(_state: any): Promise<unknown> {
  try {
    // check for cached results first
    const cacheKey = `knowledge:${_state.incidentId ? _state.incidentId : _state.conversationId}`;
    const cachedResult = await getFromCache(cacheKey);
    if (cachedResult) {
      logger.info(
        `Knowledge agent cache hit for incident ${_state.incidentId} >>> ${cachedResult}`,
      );

      return {
        knowledgeFindings: cachedResult,
        currentAgent: "knowledge",
        knowledgeAgentStatus: "completed",
        correlationAgentStatus:
          _state.correlationAgentStatus === "pending" ? "running" : "running",
      };
    }
    // Generate a search query from the incident context
    const query_schema = z.object({
      queries: z.array(z.string()),
    });
    const query_prompt = `Given this incident:
        Severity: ${_state.triageResult?.severity}
        Affected Services: ${_state.triageResult?.affectedServices.join(", ")}
        Description: ${_state.userMessage}
        
     Generate 3 search queries to find relevant runbooks and documentation.`;
    const llm = createLLM();
    const structuredLlm = llm.withStructuredOutput(query_schema);
    const res: any = await structuredLlm.invoke(query_prompt, {
      metadata: { "emit-messages": false },
    });
    const queries = res.queries;
    //  Retrieve documents for each query
    const allDocs = [];
    for (const query of queries) {
      const docs = await retrieveDocuments(query, { topK: 5 });
      allDocs.push(...docs);
    }
    //Re-rank to get the most relevant results
    const reranked = await rerankResults(_state.userMessage, allDocs, {
      topK: 5,
    });
    // Generate findings from the relevant documents
    const findingsPrompt = `Based on these runbook excerpts, what actions should be taken?
        ${reranked.map((d: any) => d.content).join("\n---\n")}`;
    const result: any = createLLM().invoke(findingsPrompt);
    const findings: Finding[] = [
      {
        id: "25",
        agentName: "knowledge",
        type: "info",
        title: "Runbook recommendations",
        description: result.content,
        confidence: 0.9,
        evidence: reranked.map((d: any) => ({
          source: d.metadata?.source || "unknown",
          content: d.content,
          score: d.score,
          metadata: d.metadata || {},
          type: "document",
        })),
        timestamp: new Date().toISOString(),
      },
    ];
    _state.incidentId && (await setInCache(cacheKey, findings, 3600)); // Cache for 1 hour
    logger.info(":::: Knowledge Agent result :::: ", findings)
    return {
      knowledgeFindings: findings,
      currentAgent: "knowledge",
      knowledgeAgentStatus: "completed",
      correlationAgentStatus:
        _state.correlationAgentStatus === "pending" ? "running" : "running",
    };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    logger.error("Error in knowledge agent:", error);

    return {
      agentErrors: [
        {
          agentName: "knowledge",
          errorCode:
            typeof (e as any)?.errorCode === "number"
              ? (e as any).errorCode
              : 500,
          message: error.message,
          stack: error.stack,
        },
      ],
      knowledgeFindings: [],
      currentAgent: "knowledge",
      knowledgeAgentStatus: "error",
      correlationAgentStatus:
        _state.correlationAgentStatus === "pending" ? "running" : "running",
    };
  }
}
