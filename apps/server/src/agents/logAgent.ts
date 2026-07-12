import type { IncidentStateType } from "../state";
import { createLLM } from "../config/providers";
import z from "zod";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { createHash } from "crypto";
import logger from "../observability";
import { getFromCache, setInCache } from "../cache";
import { AgentStatus } from "@incidentiq/shared-types";
import { searchLogsTool } from "./tools";

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
  try {
    const cacheKey = `log:${_state.incidentId ? _state.incidentId : _state.conversationId}`;
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
    const result = await agent.invoke(
      {
        messages: [
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
        ],
      },
      { recursionLimit: 15, metadata: { "emit-messages": false } },
    );
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
    const lastMessage = result.messages[result.messages.length - 1];
    const structured = await structuredLlm.invoke(
      `Extract structured findings from this analysis:\n\n${lastMessage.content}`,
      { recursionLimit: 15, metadata: { "emit-messages": false } },
    );
    const logFindings = structured.findings.map((f, i) => ({
      id: `log-finding-${i + 1}`,
      agentName: "log-analysis",
      ...f,
    }));
    _state.incidentId && (await setInCache(cacheKey, logFindings, 3600)); // Cache for 1 hour
    logger.info(`:::: Log Agent Results for incident ${_state.incidentId} :::: ${JSON.stringify(logFindings)}`);
    return {
      logFindings: logFindings,
      currentAgent: "log-analysis",
      logAgentStatus: "completed",
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
