
import { createLLM } from "../config/providers";
import type { IncidentStateType } from "../state";
import { v4 as uuid } from "uuid";
import z from "zod";
import { prisma } from "../config/prisma";
import { AIMessage } from "@langchain/core/messages";
import { ingestFactsToKnowledgeBase } from "../rag/ingest";
import { validateOutput } from "../guardrails";
import { logger } from "../observability/index";

export async function rcaAgent(_state: IncidentStateType): Promise<any> {
  try {
    const llm = createLLM();
    const rcaPrompt = `Generate a Root Cause Analysis (RCA) document for this incident.

    INCIDENT: ${_state.triageResult?.summary}
    SEVERITY: ${_state.triageResult?.severity}
    AFFECTED SERVICES: ${_state.triageResult?.affectedServices.join(", ")}
    CORRELATIONS: ${_state.correlations.map((c) => `- ${c.primaryRootCause} (confidence: ${c.overallConfidence})`).join("\n")}
    LOG FINDINGS: ${_state.logFindings.map((f) => `- ${f.title}: ${f.description}`).join("\n")}
    METRIC FINDINGS: ${_state.metricFindings.map((f) => `- ${f.title}: ${f.description}`).join("\n")}
    KNOWLEDGE BASE FINDINGS: ${_state.knowledgeFindings.map((f) => `- ${f.title}: ${f.description}`).join("\n")}
    Generate a structured RCA with these sections:
      1. **Executive Summary** â€” One paragraph for leadership
      2. **Timeline** â€” Chronological events
      3. **Root Cause** â€” Technical root cause with evidence
      4. **Impact** â€” Blast radius, users affected, duration
      5. **Resolution** â€” Steps taken / recommended to resolve
      6. **Action Items** â€” Preventive measures with owners and due dates
      7. **Lessons Learned** â€” What went well, what didn't

      Use markdown formatting.`;

    const result = await llm.invoke(rcaPrompt);

    const structuredSchema = z.object({
      facts: z
        .array(z.string())
        .describe("Key conclusions: root cause, impact numbers, resolution"),
      context: z
        .array(z.string())
        .describe(
          "Contextual information relevant to the RCA which is useful in future.",
        ),
    });

    const structuredLlm = llm.withStructuredOutput(structuredSchema);

    // output guardrails: ensure that the output is structured and safe to ingest into the knowledge base
    const validOutput = await validateOutput(result.content as string, _state.userMessage);

    logger.info(`:::: RCA Agent result for incident ${_state.incidentId} :::: ${result.content as string}`);

    // Fire-and-forget: don't block the response for fact extraction + DB save
    extractAndSaveFacts(_state.conversationId, structuredLlm, result.content as string);    

    return {
      rca: validOutput?.valid ? result.content as string : validOutput?.sanitizedOutput || "Output Validation Failed",
      currentAgent: "rca-generator",
      rcaAgentStatus: "completed",
      messages: [
        new AIMessage(result.content as string)
      ]
    };
  } catch (e) {
    logger.error("Error in RCA Agent:", e);
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      rca: "",
      agentErrors: [{
        agentName: "rca",
        errorCode:  typeof (e as any)?.errorCode === "number" ? (e as any).errorCode : 500,
        message: err.message,
        stack: err.stack,
      }],
      currentAgent: "rca-generator",
      rcaAgentStatus: "error",
      messages: [],
    };
  }
}

function extractAndSaveFacts(conversationId: string, structuredLlm: any, rcaContent: string) {
  structuredLlm.invoke(
    `Extract key facts and context from this RCA which can be useful for future analysis:\n\n${rcaContent}`,
  )
    .then((extracted: { facts: string[]; context: string[] }) => {
      return ingestFactsToKnowledgeBase(conversationId, extracted.facts, extracted.context);
    })
    .catch((error: any) => {
      logger.error("Error ingesting facts and context:", error);
    });
}


