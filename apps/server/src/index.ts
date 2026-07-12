import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { incidentRouter } from './routes/incidents';
import { logger } from './observability';
import { getCheckPointer, getPool } from './config/providers';
import { handler } from './routes/copilotkit';
import copilotKitHandler from './routes/langgraphHandler';





const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
//mounting copilotkit handler before compression to avoid issues with SSE streaming endpoints
app.use('/api/copilotkit', handler);
app.use(cors({ origin: config.server.corsOrigin, credentials: true }));
app.use(express.json({ limit: '50mb' })); // Large limit for base64 attachments
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/health', healthRouter);
app.use('/api/incidents', incidentRouter);

// app.use('/api/invokeGraph', async (req, res) => {
//  let clientDisconnected = false;
//   res.on('close', () => {
//    if (!res.writableEnded) {
//       clientDisconnected = true;
//     }
//   });
//    let input: RunAgentInput;
//   try {
//     input = RunAgentInputSchema.parse(req.body);
//   } catch (err) {
//     res.status(422).json({ error: (err as Error).message });
//     return;
//   }

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");
//   res.flushHeaders();

//   const encoder = new EventEncoder();
//   const { threadId, runId, messages } = input;
//   const config = { configurable: { thread_id: threadId } };

//   res.write(encoder.encode({ type: EventType.RUN_STARTED, threadId, runId }));

//   try {
//     const graph = await getOrchestrator();
//     const resumeValue = (input as any).forwardedProps?.command?.resume;
//     const graphInput = resumeValue !== undefined
//       ? new Command({ resume: resumeValue }) as any
//       : { 
//         messages: toLangChainMessages(messages),
//         copilotkit: {
//             context: input.context ?? [],
//             actions: input.tools ?? [],
//           },
//        };

//     const eventStream = graph.streamEvents(graphInput, { ...config, version: "v2" as const });

//     let activeMessageId: string | null = null;
//     let activeToolCallId: string | null = null;

//     for await (const event of eventStream) {
//        if (clientDisconnected) {
//         break; // stop consuming/streaming once nobody's listening
//       }
//       switch (event.event) {
//         case "on_chat_model_stream": {
//           const chunk = event.data?.chunk;
//           const toolCallChunks = chunk?.tool_call_chunks;
//           const text = chunk?.content;

//           if (toolCallChunks?.length) {
//             const tc = toolCallChunks[0];
//             if (tc.id && tc.id !== activeToolCallId) {
//               if (activeToolCallId) {
//                 res.write(encoder.encode({ type: EventType.TOOL_CALL_END, toolCallId: activeToolCallId }));
//               }
//               activeToolCallId = tc.id;
//               res.write(encoder.encode({
//                 type: EventType.TOOL_CALL_START,
//                 toolCallId: tc.id,
//                 toolCallName: tc.name ?? "unknown",
//                 parentMessageId: chunk.id,
//               }));
//             }
//             if (tc.args) {
//               res.write(encoder.encode({ type: EventType.TOOL_CALL_ARGS, toolCallId: activeToolCallId!, delta: tc.args }));
//             }
//           } else if (text) {
//             if (!activeMessageId) {
//               activeMessageId = chunk.id ?? uuidv4();
//               res.write(encoder.encode({ type: EventType.TEXT_MESSAGE_START, messageId: activeMessageId, role: "assistant" }));
//             }
//             res.write(encoder.encode({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: activeMessageId, delta: text }));
//           }
//           break;
//         }

//         case "on_chat_model_end": {
//           if (activeToolCallId) {
//             res.write(encoder.encode({ type: EventType.TOOL_CALL_END, toolCallId: activeToolCallId }));
//             activeToolCallId = null;
//           }
//           if (activeMessageId) {
//             res.write(encoder.encode({ type: EventType.TEXT_MESSAGE_END, messageId: activeMessageId }));
//             activeMessageId = null;
//           }
//           const state = await graph.getState(config);
//           res.write(encoder.encode({ type: EventType.STATE_SNAPSHOT, snapshot: state.values }));
//           break;
//         }
//       }
//     }

//     // ---- Interrupt check: the graph stops yielding events silently when paused ----
//     const stateAfterRun = await graph.getState(config);
//     const pendingInterrupt = stateAfterRun.tasks?.find((t: any) => t.interrupts?.length)?.interrupts?.[0];

//     if (pendingInterrupt) {
//       res.write(encoder.encode({
//         type: EventType.CUSTOM,
//         name: "on_interrupt",
//         value: pendingInterrupt.value,
//       }));
//       res.write(encoder.encode({ type: EventType.STATE_SNAPSHOT, snapshot: stateAfterRun.values }));
//       res.write(encoder.encode({ type: EventType.RUN_FINISHED, threadId, runId }));
//       res.end();
//       return; // stop here — don't send MESSAGES_SNAPSHOT, the run is paused, not complete
//     }

//     // ---- Normal completion (no interrupt) ----
//     res.write(encoder.encode({
//       type: EventType.MESSAGES_SNAPSHOT,
//       messages: (stateAfterRun.values.messages ?? []).map((m: any) => ({
//         id: m.id ?? uuidv4(),
//         role: m._getType?.() === "human" ? "user" : "assistant",
//         content: m.content,
//         toolCalls: m.tool_calls ?? [],
//       })),
//     }));
//     res.write(encoder.encode({ type: EventType.STATE_SNAPSHOT, snapshot: stateAfterRun.values }));
//     res.write(encoder.encode({ type: EventType.RUN_FINISHED, threadId, runId }));
//   } catch (err) {
//     if (!clientDisconnected) {
//       res.write(encoder.encode({ type: EventType.RUN_ERROR, message: (err as Error).message }));
//     }
//     // res.write(encoder.encode({ type: EventType.RUN_ERROR, message: (err as Error).message }));
//   }

//    if (!clientDisconnected) res.end();
//   //  res.end();

// });
app.use ('/api/invokeGraph', copilotKitHandler);
// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
const { port, host } = config.server;



app.listen(port, host, async () => {
  logger.info(`🚀 IncidentIQ AI Server running at http://${host}:${port}`);
  logger.info(`   Environment: ${config.server.nodeEnv}`);
  logger.info(`   LLM Provider: ${config.llm.provider} (${config.llm.model})`);
  logger.info(`   Vector Store: ${config.vectorStore.provider}`);
  logger.info(`   Embeddings: ${config.embeddings.provider} (${config.embeddings.model})`);
  await getCheckPointer();
  await getPool();
});

export default app;
