import { Router, Request, Response } from 'express';
import type { HealthResponse } from '@incidentiq/shared-types';
export const healthRouter = Router();
import { prisma } from "../config/prisma";
import { getRedisClient } from '../config/providers';
import logger from '../observability';


async function checkRedis(): Promise<boolean> {
  const _redisClient = await getRedisClient();
  return _redisClient.ping()
  .then((res: any) => {
    logger.info('✅ Redis is healthy:', res);
    return true;
  })
  .catch((err: any) => {
    logger.error('❌ Redis check failed:', err);
    return false;
  })

}

async function checkDatabase(): Promise<boolean> {
  return prisma.$queryRaw`SELECT 1`
  .then(() => {
    logger.info('✅ Database is healthy');
    return true;
  })
  .catch((err) => {
    logger.error('❌ Database check failed:', err);
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
