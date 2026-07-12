import { Router, Request, Response } from 'express';
import type { HealthResponse } from '@incidentiq/shared-types';
import { createClient } from 'redis';
import { config } from '../config';
export const healthRouter = Router();
import { prisma } from "../config/prisma";


function checkRedis(): Promise<boolean> {
  const _redisClient = createClient({ url: config.redis.url })
  return _redisClient.ping()
  .then((res) => {
    console.log('✅ Redis is healthy:', res);
    return true;
  })
  .catch((err) => {
    console.error('❌ Redis check failed:', err);
    return false;
  })

}

function checkDatabase(): Promise<boolean> {
  return prisma.$queryRaw`SELECT 1`
  .then(() => {
    console.log('✅ Database is healthy');
    return true;
  })
  .catch((err) => {
    console.error('❌ Database check failed:', err);
    return false;
  });
}

healthRouter.get('/', async (_req: Request, res: Response) => {

  const dbHealthy = await checkDatabase();
  const redisHealthy = await checkRedis();

  const health: HealthResponse = {
    status: 'healthy',
    version: '0.1.0',
    services: {
      database: dbHealthy,
      redis: redisHealthy,
      llm: !!process.env.LLM_API_KEY,
    },
  };

  const allHealthy = Object.values(health.services).every(Boolean);
  health.status = allHealthy ? 'healthy' : 'degraded';

  res.status(allHealthy ? 200 : 503).json(health);
});
