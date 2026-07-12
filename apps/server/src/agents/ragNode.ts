import { AIMessage } from "@langchain/core/messages";
import { createRAGChain } from "../rag/chain";
import type { IncidentStateType } from "../state";
import { logger } from "../observability";
import { formatAgentError } from "../middleware/errorHandler";

export async function ragNode(_state: IncidentStateType) {
    try {
    const ragChain = await createRAGChain();
    const result = await ragChain.invoke(_state.userMessage);
    logger.info(`::::RAG Node result for incident ${_state.incidentId} :::: ${result}`);
    return { messages: [new AIMessage(result as string)], currentAgent: "Rag" };
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.error("Error in ragNode:", err);
        return { currentAgent: "Rag", messages: [ new AIMessage(formatAgentError("RAG Node", err.message)) ] };
    }
}

