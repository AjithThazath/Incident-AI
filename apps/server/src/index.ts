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
//mounting copilotkit handler before to avoid issues with SSE streaming endpoints
app.use(cors({ origin: config.server.corsOrigin, credentials: true }));
app.use(handler);
app.use(express.json({ limit: '50mb' })); // Large limit for base64 attachments
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/health', healthRouter);
app.use('/api/incidents', incidentRouter);
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
  logger.info(`🚀 IncidentIQ AI Server running at https://${host}:${port}`);
  logger.info(`   Environment: ${config.server.nodeEnv}`);
  logger.info(`   LLM Provider: ${config.llm.provider} (${config.llm.model})`);
  logger.info(`   Vector Store: ${config.vectorStore.provider}`);
  logger.info(`   Embeddings: ${config.embeddings.provider} (${config.embeddings.model})`);
  await getCheckPointer();
  await getPool();
});

export default app;
