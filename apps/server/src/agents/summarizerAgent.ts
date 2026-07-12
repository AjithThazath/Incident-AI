import { createClassifierModel, createLLM } from "../config/providers";
import type { IncidentStateType } from "../state";
import { logger } from "../observability";
import { AIMessage } from "@langchain/core/messages";
import { formatAgentError } from "../middleware/errorHandler";

export async function summarizerAgent(_state: IncidentStateType) {
  try { 
      const llm = createClassifierModel();
      const prompt = `Summarize the following conversation. Preserve key findings, decisions,
                   root cause theories, and action items.
                   
                   ${JSON.stringify(_state.messages)}`;
    
      const result = await llm.invoke(prompt);
      logger.info(`:::: Summarizer Agent result for incident ${_state.incidentId} :::: ${result.content as string}`);
      return {
        conversationSummary: result.content as string,
      }
  } catch( error) {
    const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error during summarization:", err);
      return {
        messages: [ new AIMessage(formatAgentError("Summarizer Agent", err.message)) ] 
      }
  }
}


