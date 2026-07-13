import { tool } from "@langchain/core/tools";
import { retrieveDocuments } from "../rag/retriever";
import { getPool } from "../config/providers";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { logger } from "../observability";

// Shared connection pool — managed by providers.ts, fetched lazily
const pool = getPool;
const LOG_PATH = path.join(process.cwd(), "data", "logs");

const getTimeRangeFilter = (timeRange?: string): { startTime: Date | null; endTime: Date | null } => {
  // Parse timeRange into a start/end window and compare against log timestamps
      let startTime: Date | null = null;
      let endTime: Date | null = null;
      if (timeRange) {
        const lastNHours = timeRange.match(/^last\s+(\d+)h$/i);
        const rangeMatch = timeRange.match(/^(.+?)\s+to\s+(.+)$/i);
        if (lastNHours) {
          endTime = new Date();
          startTime = new Date(endTime.getTime() - parseInt(lastNHours[1]) * 3_600_000);
        } else if (rangeMatch) {
          startTime = new Date(rangeMatch[1].trim());
          endTime = new Date(rangeMatch[2].trim());
        }
      }
      return { startTime, endTime };
}

const searchRunbooksTool = tool(
  async (input: { query: string; topK?: number }) => {
    const doc = await retrieveDocuments(input.query, { topK: input.topK ?? 5 });
    return doc.map((d: any) => `[${d.metadata.source}] ${d.content}`).join('\n---\n');
  },
  {
    name: 'search_runbooks',
    description: 'Search runbooks and documentation for information related to the query',
    schema: z.object({
      query: z.string().describe('The search query'),
      topK: z.number().optional().describe('Number of results to return'),
    }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Zod 3.25+ deep type recursion with LangChain
  }
);

export const searchLogsTool = tool(
  async (input: { pattern: string; service?: string; affectedServices?: string[]; timeRange?: string }) => {
    const { startTime, endTime } = getTimeRangeFilter(input.timeRange);
    const normalizedPattern = input.pattern.trim().toLowerCase();
    const normalizedServices = [input.service, ...(input.affectedServices ?? [])]
      .filter((service): service is string => Boolean(service))
      .map((service) => service.toLowerCase());

    const parseLineTimestamp = (line: string): Date | null => {
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/);
      if (!tsMatch) return null;
      const parsed = new Date(tsMatch[1].replace(" ", "T"));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const isInTimeRange = (line: string): boolean => {
      if (!startTime || !endTime) return true;
      const lineTimestamp = parseLineTimestamp(line);
      return Boolean(lineTimestamp && lineTimestamp >= startTime && lineTimestamp <= endTime);
    };

    const isMatchingLine = (line: string): boolean => {
      const normalizedLine = line.toLowerCase();
      const matchesPattern = normalizedPattern.length > 0 && normalizedLine.includes(normalizedPattern);
      const matchesService = normalizedServices.some((service) => normalizedLine.includes(service));
      return (matchesPattern || matchesService) && isInTimeRange(line);
    };

    try {
      let files = await readdir(LOG_PATH);
      files = files.filter((file) => file.endsWith(".log") || file.endsWith(".txt"));

      const readPromises = files.map(async (file) => {
        const fullPath = path.join(LOG_PATH, file);
        const content = await readFile(fullPath, "utf-8");
        const matchingLines = content
          .split(/\r?\n/)
          .filter((line) => line.trim().length > 0)
          .filter((line) => isMatchingLine(line))
          .map((line) => `[${file}] ${line}`);

        return matchingLines;
      });

      const allMatches = (await Promise.all(readPromises)).flat();
      if (allMatches.length === 0) return 'No matching log lines found';
      logger.info(`Found ${allMatches.length} matching log lines for pattern "${input.pattern}" and services [${normalizedServices.join(', ')}]`);
      return allMatches.slice(0, 200).join('\n');
    } catch (err: any) {
      logger.error('Error reading log files:', err);
      return 'Error reading log files';
    }
  },
  {
    name: 'search_logs',
    description: 'Search local log files for matching error patterns and services',
    schema: z.object({
      pattern: z.string().describe('Text pattern or error code to search for'),
      service: z.string().optional().describe('Primary service name to prioritize in matching lines'),
      affectedServices: z.array(z.string()).optional().describe('Additional affected service names from triage context'),
      timeRange: z.string().optional().describe('Time range like "last 1h" or "2024-01-15 14:00 to 15:00"'),
    }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Zod 3.25+ deep type recursion with LangChain
  }
);

export const query_metric_data = tool(
  async (input: { service: string; metric: string; timeRange?: string }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(input.service)) {
      return 'Invalid service name: only alphanumeric characters, hyphens, and underscores are allowed';
    }

    const { startTime, endTime } = getTimeRangeFilter(input.timeRange);

    // Columns to aggregate — 'all' expands to every metric column
    const allColumns = ['cpu_pct', 'memory_pct', 'error_rate', 'latency_p99', 'request_count'] as const;
    const metricKeys = input.metric === 'all'
      ? [...allColumns]
      : [input.metric as typeof allColumns[number]];

    try {
      // Compute min/max/avg/p95 server-side in a single aggregation query
      const params: (string | Date)[] = [input.service];
      if (startTime && endTime) { params.push(startTime, endTime); }
      const aggCols = metricKeys.flatMap(k => [
        `MIN(${k}) AS "${k}_min"`,
        `MAX(${k}) AS "${k}_max"`,
        `AVG(${k}) AS "${k}_avg"`,
        `PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${k}) AS "${k}_p95"`,
      ]);
      const aggSql = `SELECT ${aggCols.join(', ')}, COUNT(*) AS row_count FROM service_metrics WHERE service = $1` +
        (startTime && endTime ? ` AND timestamp >= $2 AND timestamp <= $3` : '');

      const result = await pool().query(aggSql, params);
      const r = result.rows[0];
      if (!r || r.row_count === '0') return 'No matching metrics found';

      const summary = metricKeys.map(k =>
        `${k}: min=${parseFloat(r[`${k}_min`]).toFixed(2)} max=${parseFloat(r[`${k}_max`]).toFixed(2)} avg=${parseFloat(r[`${k}_avg`]).toFixed(2)} p95=${parseFloat(r[`${k}_p95`]).toFixed(2)}`
      );
      const resultString = `Service: ${input.service} | Rows: ${r.row_count}\n${summary.join('\n')}`;
      logger.info(`Queried metrics for service "${input.service}" and metric "${input.metric}" with time range "${input.timeRange ?? 'all'}":\n${resultString}`);
      return resultString;
    } catch (err: any) {
      logger.error('Error querying metrics:', err);
      throw err;
    }
  },
  {
    name: 'query_metrics',
    description: 'Query time-series metrics (CPU, memory, error_rate, latency) for a service',
    schema: z.object({
      service: z.string().describe('Service name'),
      metric: z.enum(['cpu_pct', 'memory_pct', 'error_rate', 'latency_p99', 'request_count', 'all']).describe('Metric to query'),
      timeRange: z.string().optional().describe('Time range like "last 1h" or "2024-01-15 14:00 to 15:00"'),
    }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Zod 3.25+ deep type recursion with LangChain
  }
);

const getIncidentTool = tool(
  async (input: { incidentId: string }) => {
    if (!input.incidentId) return 'Incident ID is required';
    const param = [ input.incidentId ];
    const sql = `SELECT id, title, description, severity, status, created_at FROM incidents WHERE id = $1`;
    try {
      const result = await pool().query(sql, param);
      if (result.rows.length === 0) return `Incident ${input.incidentId} not found`;
      const r = result.rows[0];
      return `ID: ${r.id}\nTitle: ${r.title}\nDescription: ${r.description}\nSeverity: ${r.severity}\nStatus: ${r.status}\nCreated At: ${r.created_at.toISOString()}`;
    } catch (err: any) {
      logger.error('Error querying incident:', err);
      return 'Error querying incident';
    }
  },{
    name: 'get_incident',
    description: 'Get details of a specific incident by ID',
    schema: z.object({
      incidentId: z.string().describe('Incident ID like INC-001'),
    }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Zod 3.25+ deep type recursion with LangChain
  }
)




export const tools = [searchRunbooksTool, searchLogsTool, query_metric_data, getIncidentTool];
