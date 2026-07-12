import type { AgentName } from "@incidentiq/shared-types";
import { createLLM } from "../config/providers";
import { GraphInterrupt, interrupt } from "@langchain/langgraph";
import { z } from "zod";
import type { IncidentStateType } from "../state";
import { logger } from "../observability";
import { RunnableConfig } from "@langchain/core/runnables";

export interface TriageResult {
  category: string;
  affectedServices: string[];
  agentsToRun: AgentName[];
  needsClarification: boolean;
  clarificationQuestion?: string;
  summary: string;
  agentErrors?: {
    agentName: string;
    errorCode: number;
    message: string;
    stack?: string;
  }[];
}

export async function triageAgent(
  _state: IncidentStateType,
  config: RunnableConfig,
): Promise<unknown> {
  // Get the llm model with structured output capabilities
  try {
    const llm = createLLM();
    //step 2 : define the output scema and link it to llm
    const triageSchema = z
      .object({
        severity: z.enum(["P1", "P2", "P3", "P4"]),
        category: z
          .string()
          .describe(
            "Incident category: infrastructure, application, security, data",
          ),
        affectedServices: z
          .array(z.string())
          .describe("List of affected service names"),
        agentsToRun: z
          .array(z.enum(["log-analysis", "knowledge", "metrics"]))
          .describe("Which specialist agents should analyze this incident"),
        needsClarification: z
          .preprocess((val) => val === true || val === "true", z.boolean())
          .describe("Whether to ask user for more details"),
        clarificationQuestion: z
          .string()
          .nullable()
          .optional()
          .describe("Question to ask the user"),
        summary: z.string().describe("Brief triage summary"),
      })
      .passthrough();
    const structuredResult = llm.withStructuredOutput(triageSchema).withRetry({ stopAfterAttempt: 2 });

    let copilotkitcontext = "";
    _state.copilotkit?.context?.forEach((ctx: any) => {
      const affectedServices = Array.isArray(ctx?.affectedServices)
        ? ctx.affectedServices.join(", ")
        : "";
      copilotkitcontext += ` affectected service: ${affectedServices},
      description ${ctx?.description}, incidentId: ${ctx?.incidentId}, severity: ${ctx?.severity},
       title: ${ctx?.title}`;
    });
    const sytemPrompt = `You are an incident triage specialist.
        Previous conversation:
        ${
          _state.conversationSummary
            ? _state.conversationSummary
            : _state.messages
                .map((m: any) => `${m._getType?.() || m.role}: ${m.content}`)
                .join("\n")
        }
        ${copilotkitcontext ? "CopilotKit context: " + copilotkitcontext : ""}
        Based on the conversation history, copilotkit context and the current message, Analyze the incident description and:
      1. Classify severity (P1=critical outage, P2=major degradation, P3=minor issue, P4=informational)
      2. Identify affected services from: auth-service, billing-service, analytics-engine,
         notification-service, api-gateway, postgres-primary, redis-cache, kafka
      3. Decide which specialist agents to invoke based on available evidence.
        following agents available: 
        a.log-analysis - looks for error patterns in logs, 
        b.knowledge - searches the knowledge base for relevant information. Always use this for all incidents to find relevant runbooks and documentation. If the knowledge base doesn't have enough information, say so clearly.,
        c.metrics - analyzes system metrics for anomalies.
      4. Always use the knowledge base to find relevant runbooks and documentation. If the knowledge base doesn't have enough information, say so clearly.
      5. If provided input is not sufficient ask for more details. Set needsClarification=true AND you MUST provide
         a clarificationQuestion string explaining what you need to know. Never set needsClarification=true without a clarificationQuestion.
      6. Return ONLY keys that are part of the schema. Do not add extra keys like title.
         
      Respond with a valid JSON object matching the required schema.`;
    let result = await structuredResult.invoke(
      [
        {
          role: "system",
          content: sytemPrompt,
        },
        { role: "user", content: String(_state.userMessage) },
      ],
      { metadata: { "emit-messages": false } },
    );

    if (result.needsClarification) {
      logger.info(
        "Triage agent needs clarification, interrupting for user input. question >> ",
        result,
      );
      const clarification = interrupt({
        question:
          result.clarificationQuestion ||
          "Can you share a bit more detail about the incident symptoms and impact?",
      });
    }
    // Return the triage result
    logger.info(`::: Triage Agent result for incident ${_state.incidentId} :::: ${JSON.stringify(result)}`);
    const triageResult = {
      triageResult: result,
      agentsToRun: result.agentsToRun,
      currentAgent: "triage",
      conversationId: config.configurable?.thread_id || _state.conversationId,
      triageAgentStatus: "completed",
      logAgentStatus: result.agentsToRun.includes("log-analysis")
        ? "running"
        : "skipped",
      knowledgeAgentStatus: result.agentsToRun.includes("knowledge")
        ? "running"
        : "skipped",
      metricsAgentStatus: result.agentsToRun.includes("metrics")
        ? "running"
        : "skipped",
      correlationAgentStatus: "pending",
      rcaAgentStatus: "pending",
    };
    logger.info("Triage agent completed successfully:", triageResult);
    return triageResult;
  } catch (e: any) {
    if (e instanceof GraphInterrupt) throw e; // let it propagate!
    logger.error("Error in triage agent:", e);
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      triageResult: null,
      agentsToRun: [],
      agentErrors: [
        {
          agentName: "triage",
          errorCode:
            typeof (e as any)?.errorCode === "number"
              ? (e as any).errorCode
              : 500,
          message: err.message,
          stack: err.stack,
        },
      ],
      currentAgent: "triage",
      conversationId: config.configurable?.thread_id || _state.conversationId,
      triageAgentStatus: "error",
    };
  }
}
