import { Command } from "@langchain/langgraph";
import { Router } from "express";
import { uuidv4 } from "zod/v4";
import { getOrchestrator } from "../agents/orchestrator";
import { RunAgentInputSchema, RunAgentInput, EventType } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import { AIMessage, BaseMessageLike, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

const copilotKitHandler = Router()

copilotKitHandler.use('/', async (req, res) => {
    let clientDisconnected = false;
    res.on('close', () => {
        if (!res.writableEnded) {
            clientDisconnected = true;
        }
    });
    let input: RunAgentInput;
    try {
        input = RunAgentInputSchema.parse(req.body);
    } catch (err) {
        res.status(422).json({ error: (err as Error).message });
        return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const encoder = new EventEncoder();
    const { threadId, runId, messages } = input;
    const config = { configurable: { thread_id: threadId } };

    res.write(encoder.encode({ type: EventType.RUN_STARTED, threadId, runId }));

    try {
        const graph = await getOrchestrator();
        const resumeValue = (input as any).forwardedProps?.command?.resume;
        const graphInput = resumeValue !== undefined
            ? new Command({ resume: resumeValue }) as any
            : {
                messages: toLangChainMessages(messages),
                copilotkit: {
                    context: input.context ?? [],
                    actions: input.tools ?? [],
                },
            };

        const eventStream = graph.streamEvents(graphInput, { ...config, version: "v2" as const });

        let activeMessageId: string | null = null;
        let activeToolCallId: string | null = null;

        for await (const event of eventStream) {
            if (clientDisconnected) {
                break; // stop consuming/streaming once nobody's listening
            }
            switch (event.event) {
                case "on_chat_model_stream": {
                    const chunk = event.data?.chunk;
                    const toolCallChunks = chunk?.tool_call_chunks;
                    const text = chunk?.content;

                    if (toolCallChunks?.length) {
                        const tc = toolCallChunks[0];
                        if (tc.id && tc.id !== activeToolCallId) {
                            if (activeToolCallId) {
                                res.write(encoder.encode({ type: EventType.TOOL_CALL_END, toolCallId: activeToolCallId }));
                            }
                            activeToolCallId = tc.id;
                            res.write(encoder.encode({
                                type: EventType.TOOL_CALL_START,
                                toolCallId: tc.id,
                                toolCallName: tc.name ?? "unknown",
                                parentMessageId: chunk.id,
                            }));
                        }
                        if (tc.args) {
                            res.write(encoder.encode({ type: EventType.TOOL_CALL_ARGS, toolCallId: activeToolCallId!, delta: tc.args }));
                        }
                    } else if (text) {
                        if (!activeMessageId) {
                            activeMessageId = chunk.id ?? uuidv4();
                            res.write(encoder.encode({ type: EventType.TEXT_MESSAGE_START, messageId: activeMessageId, role: "assistant" }));
                        }
                        res.write(encoder.encode({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: activeMessageId, delta: text }));
                    }
                    break;
                }

                case "on_chat_model_end": {
                    if (activeToolCallId) {
                        res.write(encoder.encode({ type: EventType.TOOL_CALL_END, toolCallId: activeToolCallId }));
                        activeToolCallId = null;
                    }
                    if (activeMessageId) {
                        res.write(encoder.encode({ type: EventType.TEXT_MESSAGE_END, messageId: activeMessageId }));
                        activeMessageId = null;
                    }
                    const state = await graph.getState(config);
                    res.write(encoder.encode({ type: EventType.STATE_SNAPSHOT, snapshot: state.values }));
                    break;
                }
            }
        }

        // ---- Interrupt check: the graph stops yielding events silently when paused ----
        const stateAfterRun = await graph.getState(config);
        const pendingInterrupt = stateAfterRun.tasks?.find((t: any) => t.interrupts?.length)?.interrupts?.[0];

        if (pendingInterrupt) {
            res.write(encoder.encode({
                type: EventType.CUSTOM,
                name: "on_interrupt",
                value: pendingInterrupt.value,
            }));
            res.write(encoder.encode({ type: EventType.STATE_SNAPSHOT, snapshot: stateAfterRun.values }));
            res.write(encoder.encode({ type: EventType.RUN_FINISHED, threadId, runId }));
            res.end();
            return; // stop here — don't send MESSAGES_SNAPSHOT, the run is paused, not complete
        }

        // ---- Normal completion (no interrupt) ----
        res.write(encoder.encode({
            type: EventType.MESSAGES_SNAPSHOT,
            messages: (stateAfterRun.values.messages ?? []).map((m: any) => ({
                id: m.id ?? uuidv4(),
                role: m._getType?.() === "human" ? "user" : "assistant",
                content: m.content,
                toolCalls: toAGUIToolCalls(m.tool_calls),
            })),
        }));
        res.write(encoder.encode({ type: EventType.STATE_SNAPSHOT, snapshot: stateAfterRun.values }));
        res.write(encoder.encode({ type: EventType.RUN_FINISHED, threadId, runId }));
    } catch (err) {
        if (!clientDisconnected) {
            res.write(encoder.encode({ type: EventType.RUN_ERROR, message: (err as Error).message }));
        }
        // res.write(encoder.encode({ type: EventType.RUN_ERROR, message: (err as Error).message }));
    }

    if (!clientDisconnected) res.end();
    //  res.end();

});

type IncomingMessage = {
    role: string;
    content?: unknown;
    id?: string;
    name?: string;
    toolCalls?: Array<{
        id?: string;
        function?: {
            name?: string;
            arguments?: string;
        };
    }>;
    toolCallId?: string;
};

function toAGUIToolCalls(toolCalls: any[] | undefined) {
  return (toolCalls ?? []).map((tc) => ({
    id: tc.id ?? uuidv4(),
    type: "function" as const,
    function: {
      name: tc.name,
      arguments: JSON.stringify(tc.args ?? {}),
    },
  }));
}

function toLangChainMessages(messages: IncomingMessage[]): BaseMessageLike[] {
    return messages.map((message) => {
        const role = message.role?.toLowerCase();
        const content = typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content ?? "");

        switch (role) {
            case "assistant":
                return new AIMessage({
                    content,
                    id: message.id,
                    name: message.name,
                    tool_calls: message.toolCalls?.map((toolCall) => {
                        const rawArgs = toolCall.function?.arguments ?? "{}";
                        let parsedArgs: Record<string, unknown> = {};

                        try {
                            parsedArgs = JSON.parse(rawArgs);
                        } catch {
                            parsedArgs = { raw: rawArgs };
                        }

                        return {
                            id: String(toolCall.id ?? uuidv4()),
                            name: toolCall.function?.name ?? "tool",
                            args: parsedArgs,
                        };
                    }),
                });
            case "tool":
                return new ToolMessage({
                    content,
                    tool_call_id: String(message.toolCallId ?? message.id ?? uuidv4()),
                    name: message.name,
                    id: message.id,
                });
            case "system":
            case "developer":
                return new SystemMessage({ content, id: message.id, name: message.name });
            default:
                return new HumanMessage({ content, id: message.id, name: message.name });
        }
    });
}

export default copilotKitHandler;