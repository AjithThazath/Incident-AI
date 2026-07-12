import z from "zod";
import { createLLM } from "../config/providers";
import type { IncidentStateType } from "../state";
import { query_metric_data } from "./tools";
import { getFromCache, setInCache } from "../cache";
import logger from "../observability";
import { AgentStatus } from "@incidentiq/shared-types";
const { createReactAgent } = require("@langchain/langgraph/prebuilt");

export async function metricsAgent(_state: IncidentStateType): Promise<{
  metricFindings: any;
  currentAgent: string;
  metricsAgentStatus: AgentStatus;
  correlationAgentStatus: AgentStatus;
  agentErrors?: {
    agentName: string;
    errorCode: number;
    message: string;
    stack?: string;
  }[];
}> {
  try {
    const cacheKey = `metrics:${_state.incidentId ? _state.incidentId : _state.conversationId}`;
    const cachedResult = await getFromCache(cacheKey);
    if (cachedResult) {
      logger.info(
        `Metrics agent cache hit for incident ${_state.incidentId} >>> ${cachedResult}`,
      );
      return {
        metricFindings: cachedResult,
        currentAgent: "metrics-analysis",
        metricsAgentStatus: "completed",
        correlationAgentStatus:
          _state.correlationAgentStatus === "pending" ? "running" : "running",
      };
    }
    // create tool to queryt metrics (already created in tools.ts)
    const llm = createLLM();
    // Step 2 create react agent with metric tools
    const metricAgent = createReactAgent({
      llm,
      tools: [query_metric_data],
      stateModifier: `You are a metrics analysis expert with access to the query_metrics tool.
      This tool queries time-series metrics (cpu_pct, memory_pct, error_rate, latency_p99, request_count) from the database for a given service.
      For the affected services, query their metrics and identify anomalies. Look for:
      - CPU/memory spikes
      - Error rate increases
      - Latency degradation
      - Correlation between metrics across services`,
    });

    const result = await metricAgent.invoke(
      {
        messages: [
          {
            role: "user",
            content: `Investigate this incident using service metrics:
- Issue: ${_state.userMessage}
- Affected services: ${JSON.stringify(_state.triageResult?.affectedServices ?? [])}

Query metrics for the affected services and summarize:
1. CPU or memory spikes
2. Error rate increases
3. Latency degradation
4. Correlations across services
5. Confidence level (low/medium/high)`,
          },
        ],
      },
      { recursionLimit: 25 },
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
              type: z.enum(["metric"]),
              content: z.string().describe("Metric data from tool"),
              source: z.string().describe("Metric source"),
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
    const lastMessageContent =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? "");
    const structured = await structuredLlm.invoke(
      `Extract structured findings from this analysis:\n\n${lastMessageContent}`,
      { recursionLimit: 15, metadata: { "emit-messages": false } },
    );
    const metricFindings = structured.findings.map((f, i) => ({
      id: `metrics-finding-${i + 1}`,
      agentName: "metrics-analysis",
      ...f,
    }));
    _state.incidentId && (await setInCache(cacheKey, metricFindings, 3600)); // Cache for 1 hour
    logger.info(`:::: Metrics Agent Results for incident ${_state.incidentId} :::: ${JSON.stringify(metricFindings)}`);
    return {
      metricFindings,
      currentAgent: "metrics-analysis",
      metricsAgentStatus: "completed",
      correlationAgentStatus:
        _state.correlationAgentStatus === "pending" ? "running" : "running",
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    logger.error("Error in metrics agent:", err);

    return {
      metricFindings: [],
      currentAgent: "metrics-analysis",
      agentErrors: [
        {
          agentName: "metrics-analysis",
          errorCode:
            typeof (e as any)?.errorCode === "number"
              ? (e as any).errorCode
              : 500,
          message: err.message,
          stack: err.stack,
        },
      ],
      metricsAgentStatus: "error",
      correlationAgentStatus:
        _state.correlationAgentStatus === "pending" ? "running" : "running",
    };
  }
}
