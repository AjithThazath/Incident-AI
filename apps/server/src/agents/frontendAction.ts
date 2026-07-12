import { tool } from "@langchain/core/tools";
import { createClassifierModel } from "../config/providers";
import { IncidentStateType } from "../state";
import { AIMessage } from "@langchain/core/messages";
import z from "zod";
import { logger } from "../observability";
import { formatAgentError } from "../middleware/errorHandler";

function isLikelyUiActionIntent(message: string): boolean {
  const text = message.toLowerCase();
  const hasNavigationVerb =
    /\b(navigate|go to|open|show|view|take me|redirect)\b/.test(text);
  const hasAnalysisIntent =
    /\b(analy[sz]e|summari[sz]e|triage|investigate|debug|diagnose|rca|root cause|what happened)\b/.test(
      text,
    );

  // Analysis requests should stay in the analysis pipeline, not trigger frontend navigation.
  if (hasAnalysisIntent && !hasNavigationVerb) {
    return false;
  }

  if (!hasNavigationVerb) {
    return false;
  }

  return /\b(dashboard|settings|chat|home|incident|inc-\d+)\b/.test(text);
}

function copilotKitActionsToTools(actions: any[]) {
  return (actions || []).map((action: any) => {
    // CopilotKit sends actions in OpenAI function format:
    // { type: "function", name: "...", function: { name, description, parameters } }
    const fn = action.function || action;
    const params: Record<string, z.ZodTypeAny> = {};
    const properties = fn.parameters?.properties || {};
    const required = fn.parameters?.required || [];

    for (const [key, val] of Object.entries(properties) as any) {
      const base = z.string().describe(val.description || key);
      params[key] = required.includes(key) ? base : base.optional();
    }

    return tool(async (args) => JSON.stringify(args), {
      name: fn.name || action.name,
      description: fn.description || "",
      schema: z.object(params),
    });
  });
}

export async function frontendActionAgent(_state: IncidentStateType) {
  const llm =  createClassifierModel();
  const normalizedActions = Array.isArray(_state.copilotkit?.actions)
    ? _state.copilotkit.actions
    : [];
  const frontendTools = copilotKitActionsToTools(normalizedActions);
  const userMessage = String(_state.userMessage ?? "").trim();

  if (frontendTools.length === 0) {
    // No frontend tools available, skip
    return { frontendAction: false };
  }

  // Only run tool-calling for clear UI intents (navigation/show/open/view).
  // This avoids model/provider mismatches where non-UI prompts trigger unknown tools.
  if (!isLikelyUiActionIntent(userMessage)) {
    return { frontendAction: false };
  }

  const llmWithTools = llm.bindTools(frontendTools);

  let response;
  try {
    response = await llmWithTools.invoke(
      [
        {
          role: "system",
          content: `You are a frontend action agent.
You can ONLY call tools that are provided in ${frontendTools}.
Never call any other tool name.Do NOT call navigation tools for analysis requests (analyze, summarize, investigate, RCA, root cause).If no provided tool matches the user request, respond with "null" and do not call a tool.
if any parameter is missing you can ask user for clarification.`,
        },
        ...(userMessage ? [{ role: "user", content: userMessage }] : []),
      ],
      { metadata: { "emit-messages": false } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Error invoking frontend action agent:", msg);
    // Provider rejected an unknown tool call; skip frontend action and continue graph.
    if (
      msg.includes("not in request.tools") ||
      msg.includes("tool call validation failed")
    ) {
      logger.warn("Frontend action skipped due to invalid tool call:", msg);
      return { frontendAction: false };
    }
    return { frontendAction: false, messages: [ new AIMessage(formatAgentError("Frontend Action", msg)) ] };
  }

  // Only return messages if tool was actually called
  if (response.tool_calls && response.tool_calls.length > 0) {
    logger.info("Frontend action tool call: ", response.tool_calls);
    return {
      messages: [response],
      currentAgent: "frontendActionAgent",
      frontendAction: true,
    };
  }

  // No tool called — return flag so routing continues
  return { frontendAction: false };
}
