import { Request, Response, NextFunction } from 'express';
import { logger } from '../observability/index';
import { IncidentStateType } from '../state';
import { interrupt } from '@langchain/langgraph';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';

  logger.error(`[${statusCode}] ${err.message}`, {
    stack: err.stack,
    isOperational: err.isOperational,
  });

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const err: AppError = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  err.isOperational = true;
  next(err);
}

export function createAppError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}


export function formatAgentError(agentLabel: string, message: string): string {
  return [
    `⚠️ **${agentLabel} Error**`,
    ``,
    `Something went wrong while processing your request.`,
    ``,
    `> ${message}`,
    ``,
    `Please try again.`,
  ].join("\n");
}