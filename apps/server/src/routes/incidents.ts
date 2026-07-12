import { Router, Request, Response } from "express";
import type { IncidentSummary } from "@incidentiq/shared-types";
import { logger } from "../observability/index";
import { prisma } from "../config/prisma";

export const incidentRouter = Router();

incidentRouter.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
    const skip = (page - 1) * pageSize;

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.incident.count(),
    ]);

    res.json({
      incidents,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logger.error("Failed to fetch incidents", { error });
    res.status(500).json({ error: { message: "Failed to fetch incidents" } });
  }
});

incidentRouter.get("/summary", async (_req: Request, res: Response) => {
  try {
    const [totalOpen, totalP1, totalP2, recentIncidents, mttrRows] =
      await Promise.all([
        prisma.incident.count({
          where: { status: { in: ["open", "investigating"] } },
        }),
        prisma.incident.count({ where: { severity: "P1" } }),
        prisma.incident.count({ where: { severity: "P2" } }),
        prisma.incident.findMany({
          where: { status: { in: ["open", "investigating"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        // avgMttr requires date arithmetic — raw query is appropriate here
        prisma.$queryRaw<[{ avg_mttr: number | null }]>`
          SELECT COALESCE(
            AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60),
            0
          )::int AS avg_mttr
          FROM incidents
          WHERE resolved_at IS NOT NULL
        `,
      ]);

    const summary: IncidentSummary = {
      totalOpen,
      totalP1,
      totalP2,
      avgMttr: Number(mttrRows[0].avg_mttr ?? 0),
      recentIncidents: recentIncidents as any,
    };

    res.json(summary);
  } catch (error) {
    logger.error("Failed to fetch incident summary", { error });
    res
      .status(500)
      .json({ error: { message: "Failed to fetch incident summary" } });
  }
});

incidentRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const incident = await prisma.incident.findUnique({
      where: { incidentId: id },
    });

    if (!incident) {
      res.status(404).json({ error: { message: `Incident ${id} not found` } });
      return;
    }
    res.json(incident);
  } catch (error) {
    logger.error("Failed to fetch incident", { error });
    res.status(500).json({ error: { message: "Failed to fetch incident" } });
  }
});
