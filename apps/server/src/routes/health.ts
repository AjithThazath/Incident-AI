import { Router, Request, Response } from 'express';
import type { HealthResponse } from '@incidentiq/shared-types';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {

  const health: HealthResponse = {
    status: 'healthy',
    version: '0.1.0',
    services: {
      database: true,   // TODO: Check actual PostgreSQL connectivity
      redis: true,       // TODO: Check actual Redis connectivity
      mlService: false,  // TODO: Check actual ML service connectivity
      llm: !!process.env.LLM_API_KEY,
    },
  };

  const allHealthy = Object.values(health.services).every(Boolean);
  health.status = allHealthy ? 'healthy' : 'degraded';

  res.status(allHealthy ? 200 : 503).json(health);
});
