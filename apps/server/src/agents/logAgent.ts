import type { IncidentStateType } from "../state";
import { createLLM } from "../config/providers";
import z from "zod";
import logger from "../observability";
import { getFromCache, setInCache } from "../cache";
import { AgentStatus } from "@incidentiq/shared-types";
import { searchLogsTool } from "./tools";
import { GraphRecursionError } from "@langchain/langgraph";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createReactAgent } = require("@langchain/langgraph/prebuilt");

export async function logAgent(
  _state: IncidentStateType,
): Promise<{
  logFindings: any;
  currentAgent: string;
  correlationAgentStatus: AgentStatus;
  logAgentStatus: AgentStatus;
  agentErrors?: {
    agentName: string;
    errorCode: number;
    message: string;
    stack?: string;
  }[];
}> {
  const cacheKey = `log:${_state.incidentId ? _state.incidentId : _state.conversationId}`;
  let hitRecursionLimit = false;

  try {
    const cachedResult = await getFromCache(cacheKey);
    if (cachedResult) {
      logger.info(
        `Log agent cache hit for incident ${_state.incidentId} >> > ${cachedResult}`,
      );
      return {
        logFindings: cachedResult,
        currentAgent: "log-analysis",
        logAgentStatus: "completed",
        correlationAgentStatus:
          _state.correlationAgentStatus === "pending" ? "running" : "running",
      };
    }

    const llm = createLLM();
    const agent = createReactAgent({
      llm: llm,
      tools: [searchLogsTool],
      stateModifier: `You are a log analysis expert. You have access to the search_logs tool.
Your task: search logs for errors related to the incident, identify root cause patterns, and build a timeline.
Always call the search_logs tool before drawing conclusions. If results are sparse, try different search patterns.`,
    });

    // Track the last known-good set of messages as the agent streams,
    // so if it blows the recursion limit we still have something to work with.
    let lastMessages: any[] = [
      {
        role: "user",
        content: `Investigate this incident by searching logs:
- Issue: ${_state.userMessage}
- Affected services: ${JSON.stringify(_state.triageResult?.affectedServices ?? [])}

Search for error patterns in the affected services and summarize:
1. Key errors found
2. Root cause candidates
3. Timeline of events
4. Confidence level (low/medium/high)`,
      },
    ];

    try {
      const stream = await agent.stream(
        { messages: lastMessages },
        {
          recursionLimit: 15,
          metadata: { "emit-messages": false },
          streamMode: "values",
        },
      );

      for await (const step of stream) {
        if (step?.messages) {
          lastMessages = step.messages;
        }
      }
    } catch (streamErr) {
      if (streamErr instanceof GraphRecursionError) {
        hitRecursionLimit = true;
        logger.info(
          `Log agent hit recursion limit for incident ${_state.incidentId}, using partial data (${lastMessages.length} messages collected)`,
        );
      } else {
        throw streamErr; // real error, let outer catch handle it
      }
    }

    const output_schema = z.object({
      findings: z.array(
        z.object({
          type: z.enum(["anomaly", "error", "warning", "info", "correlation"]),
          title: z.string().describe("Short title summarizing the finding"),
          description: z
            .string()
            .describe("Detailed description with reasoning"),
          confidence: z.number().min(0).max(1),
          timestamp: z
            .string()
            .describe("ISO timestamp from the earliest evidence"),
          evidence: z.array(
            z.object({
              type: z.enum(["log_line"]),
              content: z.string().describe("Exact log line from tool output"),
              source: z.string().describe("Log filename"),
              metadata: z.object({
                service: z.string(),
                level: z.enum(["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]),
              }),
            }),
          ),
        }),
      ),
    });

    const structuredLlm = llm.withStructuredOutput(output_schema);
    const lastMessage = lastMessages[lastMessages.length - 1];

    const structured = await structuredLlm.invoke(
      `Extract structured findings from this ${hitRecursionLimit ? "PARTIAL (recursion limit reached before completion) " : ""}analysis:\n\n${lastMessage?.content ?? "No analysis content was produced."}`,
      { recursionLimit: 15, metadata: { "emit-messages": false } },
    );

    const logFindings = structured.findings.map((f, i) => ({
      id: `log-finding-${i + 1}`,
      agentName: "log-analysis",
      partial: hitRecursionLimit || undefined,
      ...f,
    }));

    // Don't cache partial results as if they were complete
    if (_state.incidentId && !hitRecursionLimit) {
      await setInCache(cacheKey, logFindings, 3600);
    }

    logger.info(
      `:::: Log Agent Results for incident ${_state.incidentId} (${hitRecursionLimit ? "partial" : "complete"}) :::: ${JSON.stringify(logFindings)}`,
    );

    return {
      logFindings: logFindings,
      currentAgent: "log-analysis",
      logAgentStatus: "completed", // still "completed", not "error"
      correlationAgentStatus:
        _state.correlationAgentStatus === "pending" ? "running" : "running",
    };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    logger.error("Log agent error:", error);
    return {
      logFindings: [],
      agentErrors: [
        {
          agentName: "logAgent",
          errorCode:
            typeof (e as any)?.errorCode === "number"
              ? (e as any).errorCode
              : 500,
          message: error.message,
          stack: error.stack,
        },
      ],
      currentAgent: "log-analysis",
      logAgentStatus: "error",
      correlationAgentStatus:
        _state.correlationAgentStatus === "pending" ? "running" : "running",
    };
  }
}