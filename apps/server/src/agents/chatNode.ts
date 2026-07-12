import { AIMessage } from "@langchain/core/messages";
import { createClassifierModel } from "../config/providers";
import type { IncidentStateType } from "../state";
import { logger } from "../observability";
import { formatAgentError } from "../middleware/errorHandler";


export async function chatNode(_state: IncidentStateType) {
  let historyMessages;
  let copilotkitcontext = "";
  try {
    const llm = createClassifierModel();
    if (_state.conversationSummary) {
      historyMessages = [
        { role: "system", content: _state.conversationSummary },
      ];
    } else {
      historyMessages = _state.messages.map((m: any) => ({
        role:
          m._getType?.() === "human"
            ? "user"
            : m._getType?.() === "ai"
              ? "assistant"
              : m.role || "user",
        content: String(m.content),
      }));
    }

    const result = await llm.invoke(
      [
        {
          role: "system",
          content: `You are an IT operations assistant. 
        Answer questions based on the conversation history and copilotkit context.
        If user query is not relevant to the incident or IT operations, politely redirect them to ask relevant questions.Be concise.
        copilot context: ${copilotkitcontext}
        `,
        },
        ...historyMessages,
        { role: "user", content: _state.userMessage },
      ],
    );

    return {
      messages: [new AIMessage(result.content as string)],
      currentAgent: "Chat",
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    logger.error("Error in chatNode:", err);
    return {
      currentAgent: "Chat",
      messages: [ new AIMessage(formatAgentError("Chat", err.message)) ] 
    };
  }
}
