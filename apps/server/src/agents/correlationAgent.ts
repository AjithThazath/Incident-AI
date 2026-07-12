import z from "zod";
import { createLLM } from "../config/providers";
import type { IncidentStateType } from "../state";
import { getFromCache, setInCache } from "../cache";
import { logger } from "../observability";

export async function correlationAgent(
  _state: IncidentStateType,
): Promise<unknown> {
  try {
    const cacheKey = `correlation:${_state.incidentId ? _state.incidentId : _state.conversationId}`;
    const cachedResult = await getFromCache(cacheKey);
    if (cachedResult) {
      logger.info(
        `Correlation agent cache hit for incident ${_state.incidentId} >>> ${cachedResult}`,
      );
      return {
        correlations: cachedResult,
        correlationAgentStatus: "completed",
        rcaAgentStatus: "running",
        currentAgent: "correlation",
      };
    }
    const llm = createLLM();
    const allFindings = [
      ..._state.logFindings,
      ..._state.metricFindings,
      ..._state.knowledgeFindings,
    ];
    if (allFindings.length === 0) {
      return {
        correlations: [],
        currentAgent: "correlation",
      };
    }
    const correlationPrompt = `You are an expert SRE correlating incident evidence.
  
        INCIDENT: ${_state.triageResult?.summary}
        SEVERITY: ${_state.triageResult?.severity}
        AFFECTED SERVICES: ${_state.triageResult?.affectedServices.join(", ")}
  
        FINDINGS FROM SPECIALIST AGENTS:
        ${allFindings.map((f) => `[${f.agentName}] ${f.title}: ${f.description}`).join("\n\n")}
  
        Analyze these findings and:
        1. Identify causal chains (X caused Y which caused Z)
        2. Find temporal correlations (events that happened around the same time)
        3. Identify the most likely root cause
        4. Rate your confidence (0-1)
        5. If findings are contradictory or insufficient, flag what additional info is needed
  
        IMPORTANT: If you need more information from the user, set needsHumanInput to true.`;

    const correlationSchema = z.object({
      correlations: z.array(
        z.object({
          id: z.string().describe("Unique correlation ID"),
          description: z
            .string()
            .describe("Short description of the correlation"),
          causalChain: z
            .array(z.string())
            .describe("Ordered sequence: X caused Y caused Z"),
          relatedFindings: z
            .array(z.string())
            .describe("IDs of findings that support this correlation"),
          confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
          rootCause: z
            .boolean()
            .describe("Whether this correlation points to the root cause"),
          explanation: z
            .string()
            .describe("Detailed explanation of how findings are connected"),
        }),
      ),
      primaryRootCause: z
        .string()
        .nullable()
        .describe("Most likely root cause summary"),
      overallConfidence: z
        .number()
        .min(0)
        .max(1)
        .describe("Overall confidence in the analysis"),
      needsHumanInput: z
        .boolean()
        .describe("Whether additional user clarification is needed"),
      clarificationQuestion: z
        .string()
        .nullable()
        .describe("Question to ask user if needsHumanInput is true"),
    });

    const result = await llm
      .withStructuredOutput(correlationSchema)
      .invoke(correlationPrompt, { metadata: { "emit-messages": false } });

    _state.incidentId &&
      (await setInCache(cacheKey, result.correlations, 3600)); // Cache for 1 hour

    return {
      correlations: result.correlations,
      currentAgent: "correlation",
      correlationAgentStatus: "completed",
      rcaAgentStatus: "running",
    };
  } catch (e) {
    logger.error("Correlation agent error :: ", e);
    const err = e instanceof Error ? e : new Error(String(e));

    return {
      correlations: [],
      agentErrors: [
        {
          agentName: "correlation",
          errorCode:
            typeof (e as any)?.errorCode === "number"
              ? (e as any).errorCode
              : 500,
          message: err.message,
          stack: err.stack,
        },
      ],
      currentAgent: "correlation",
      correlationAgentStatus: "error",
      rcaAgentStatus: "running",
    };
  }
}
