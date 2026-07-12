// src/components/AgentStepsRenderer.tsx
import { useEffect, useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { useCopilotChat } from "@copilotkit/react-core";
import type { AgentStatus } from "@incidentiq/shared-types";
import "./AgentStepsRenderer.css";

type StepStatus = "pending" | "running" | "completed" | "error";

const AGENT_META: Record<string, { stateStatusKey: string; label: string }> = {
  triage: { stateStatusKey: "triageAgentStatus", label: "Triage" },
  knowledge: { stateStatusKey: "knowledgeAgentStatus", label: "Knowledge" },
  "log-analysis": { stateStatusKey: "logAgentStatus", label: "Logs" },
  metrics: { stateStatusKey: "metricsAgentStatus", label: "Metrics" },
  correlation: { stateStatusKey: "correlationAgentStatus", label: "Correlation" },
  "rca-generator": { stateStatusKey: "rcaAgentStatus", label: "RCA" },
};

function hasTriageResultData(triageResult: unknown): boolean {
  return !!triageResult && typeof triageResult === "object" && !Array.isArray(triageResult) && Object.keys(triageResult).length > 0;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

function normalizeStatus(raw: unknown): AgentStatus | null {
  if (typeof raw !== "string") return null;
  const value = raw.toLowerCase().trim();
  if (value === "skip") return "skipped";
  if (value === "skipped" || value === "pending" || value === "running" || value === "completed" || value === "error") {
    return value as AgentStatus;
  }
  return null;
}

function AgentResultCard({
  title,
  badge,
  badgeVariant = "p4",
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: string;
  badgeVariant?: "p1" | "p2" | "p3" | "p4" | "rca";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="agent-result-card" open={defaultOpen}>
      <summary className="agent-result-card__header">
        <div className="agent-result-card__header-left">
          {badge && (
            <span className={`agent-result-card__badge agent-result-card__badge--${badgeVariant}`}>
              {badge}
            </span>
          )}
          <span className="agent-result-card__title">{title}</span>
        </div>
        <span className="agent-result-card__chevron" />
      </summary>
      <div className="agent-result-card__body">{children}</div>
    </details>
  );
}

function TriageContent({ triageResult }: { triageResult: any }) {
  if (!triageResult?.severity) return <p className="agent-step__empty">No triage result yet.</p>;
  const severity = (triageResult.severity as string).toLowerCase() as "p1" | "p2" | "p3" | "p4";
  return (
    <AgentResultCard title="Triage Agent" badge={triageResult.severity} badgeVariant={severity}>
      <p className="agent-result-card__summary">{triageResult.summary}</p>
      <p className="agent-result-card__meta"><strong>Category:</strong> {triageResult.category}</p>
      <p className="agent-result-card__meta"><strong>Affected Services:</strong> {triageResult.affectedServices?.join(", ")}</p>
    </AgentResultCard>
  );
}

function FindingsContent({
  findings,
  title,
  badge,
  badgeVariant,
}: {
  findings: any[];
  title: string;
  badge: string;
  badgeVariant: "p1" | "p2" | "p3" | "p4" | "rca";
}) {
  if (!findings?.length) return <p className="agent-step__empty">No findings yet.</p>;
  return (
    <AgentResultCard title={`${title} (${findings.length})`} badge={badge} badgeVariant={badgeVariant}>
      {findings.map((finding: any, i: number) => (
        <AgentResultCard
          key={i}
          title={finding.title || `Finding ${i + 1}`}
          badge={finding.type}
          badgeVariant={badgeVariant}
          defaultOpen={false}
        >
          <p className="agent-result-card__summary">{finding.description}</p>
          <p className="agent-result-card__meta"><strong>Confidence:</strong> {finding.confidence}</p>
          {finding.evidence?.map((ev: any, j: number) => (
            <AgentResultCard key={j} title="Evidence" defaultOpen={false}>
              <p className="agent-result-card__summary">{ev.content}</p>
              <p className="agent-result-card__meta"><strong>Source:</strong> {ev.source}</p>
              {ev.score != null && (
                <p className="agent-result-card__meta"><strong>Score:</strong> {ev.score}</p>
              )}
            </AgentResultCard>
          ))}
        </AgentResultCard>
      ))}
    </AgentResultCard>
  );
}

function AgentErrorContent({ error }: { error: any }) {
  if (!error) return null;

  return (
    <AgentResultCard title="Agent Error" badge="ERR" badgeVariant="p1">
      <p className="agent-result-card__summary">{error.message || "Unknown error"}</p>
      {error.errorCode != null && (
        <p className="agent-result-card__meta"><strong>Error Code:</strong> {error.errorCode}</p>
      )}
      {error.agentName && (
        <p className="agent-result-card__meta"><strong>Agent:</strong> {error.agentName}</p>
      )}
    </AgentResultCard>
  );
}

export function AgentStepsRenderer() {
  const { agent } = useAgent();
  const { visibleMessages: chatMessages } = useCopilotChat();
  const s: any = agent?.state;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const lastInvocationKeyRef = useRef<string | null>(null);
  const baselineDataRef = useRef<Record<string, string>>({});
  const prevTriageStatusRef = useRef<AgentStatus | null>(null);

  if (!s) return null;

  const copilotMessages: any[] = Array.isArray(chatMessages) ? chatMessages : [];
  const userMessages = copilotMessages.filter((message) => {
    const messageType = typeof message?._getType === "function" ? message._getType() : message?.type;
    return message?.role === "user" || messageType === "human";
  });
  const latestUserMessage = userMessages[userMessages.length - 1];
  const latestUserSignature = safeStringify(latestUserMessage?.content ?? "");
  const invocationKey = `${userMessages.length}:${latestUserSignature}`;

  if (lastInvocationKeyRef.current !== invocationKey) {
    lastInvocationKeyRef.current = invocationKey;
    baselineDataRef.current = {
      triage: safeStringify(s.triageResult),
      knowledge: safeStringify(s.knowledgeFindings ?? []),
      log: safeStringify(s.logFindings ?? []),
      metrics: safeStringify(s.metricFindings ?? []),
      correlation: safeStringify(s.correlations ?? []),
      rca: safeStringify(s.rca ?? null),
    };
  }

  useEffect(() => {
    setOpenKey(null);
  }, [invocationKey]);

  const triageReady = hasTriageResultData(s.triageResult);
  const hasFreshResultData = (key: string, value: unknown): boolean => {
    return baselineDataRef.current[key] !== safeStringify(value);
  };

  const triageFreshReady = triageReady && hasFreshResultData("triage", s.triageResult);

  useEffect(() => {
    if (!triageReady) {
      setOpenKey(null);
    }
  }, [triageReady]);

  const hasAgentResultData = (agentId: string): boolean => {
    switch (agentId) {
      case "triage":
        return triageFreshReady;
      case "knowledge":
        return Array.isArray(s.knowledgeFindings)
          && s.knowledgeFindings.length > 0
          && hasFreshResultData("knowledge", s.knowledgeFindings);
      case "log-analysis":
        return Array.isArray(s.logFindings)
          && s.logFindings.length > 0
          && hasFreshResultData("log", s.logFindings);
      case "metrics":
        return Array.isArray(s.metricFindings)
          && s.metricFindings.length > 0
          && hasFreshResultData("metrics", s.metricFindings);
      case "correlation":
        return Array.isArray(s.correlations)
          && s.correlations.length > 0
          && hasFreshResultData("correlation", s.correlations);
      case "rca-generator":
        return !!s.rca && hasFreshResultData("rca", s.rca);
      default:
        return false;
    }
  };

  const getAgentStatus = (agentId: string): AgentStatus | null => {
    const meta = AGENT_META[agentId];
    if (!meta) return null;
    return normalizeStatus(s?.[meta.stateStatusKey]);
  };

  const triageStatus = getAgentStatus("triage");

  useEffect(() => {
    const previous = prevTriageStatusRef.current;
    if (triageStatus === "running" && previous !== "running") {
      setOpenKey(null);
      baselineDataRef.current = {
        triage: safeStringify(s?.triageResult),
        knowledge: safeStringify(s?.knowledgeFindings ?? []),
        log: safeStringify(s?.logFindings ?? []),
        metrics: safeStringify(s?.metricFindings ?? []),
        correlation: safeStringify(s?.correlations ?? []),
        rca: safeStringify(s?.rca ?? null),
      };
    }
    prevTriageStatusRef.current = triageStatus;
  }, [
    triageStatus,
    s?.triageResult,
    s?.knowledgeFindings,
    s?.logFindings,
    s?.metricFindings,
    s?.correlations,
    s?.rca,
  ]);

  const getLatestErrorForStep = (agentId: string) => {
    const allErrors = Array.isArray(s.agentErrors) ? s.agentErrors : [];
    const aliases: Record<string, string[]> = {
      triage: ["triage"],
      knowledge: ["knowledge", "knowledgeAgent"],
      "log-analysis": ["log-analysis", "logAgent"],
      metrics: ["metrics", "metrics-analysis", "metricsAgent"],
      correlation: ["correlation", "correlationAgent"],
      "rca-generator": ["rca", "rca-generator", "rcaAgent"],
    };

    const accepted = new Set(aliases[agentId] || [agentId]);
    const matches = allErrors.filter((e: any) => accepted.has(String(e?.agentName)));
    return matches.length > 0 ? matches[matches.length - 1] : null;
  };

  const stepStatus = (agentId: string): StepStatus => {
    const normalized = getAgentStatus(agentId);
    if (normalized === "running") return "running";
    if (normalized === "completed") return "completed";
    if (normalized === "error") return "error";
    if (normalized === "pending") return "pending";
    if (hasAgentResultData(agentId)) return "completed";
    return "pending";
  };

  if (!triageStatus) {
    return null;
  }

  const agentsToRun = Array.isArray(s
    .agentsToRun) ? s.agentsToRun : [];

  // Build steps from triage + selected specialist agents, then append downstream stages when present.
  const stepIds = [
    "triage",
    ...agentsToRun,
    ...(agentsToRun.length > 0 ? ["correlation", "rca-generator"] : []),
  ].filter((agentId) => AGENT_META[agentId]);

  const uniqueSteps = Array.from(new Set(stepIds)).filter((agentId) => {
    const status = getAgentStatus(agentId);
    return status !== "skipped";
  });

  if (uniqueSteps.length === 0) {
    return null;
  }

  const isCurrentRunComplete = (agentId: string) => stepStatus(agentId) === "completed";

  const renderOverlayContent = (agentId: string): React.ReactNode => {
    const stepError = getLatestErrorForStep(agentId);

    switch (agentId) {
      case "triage":
        return (
          <>
            <TriageContent triageResult={isCurrentRunComplete("triage") ? s.triageResult : null} />
            <AgentErrorContent error={stepError} />
          </>
        );
      case "knowledge":
        return (
          <>
            <FindingsContent findings={isCurrentRunComplete("knowledge") ? s.knowledgeFindings ?? [] : []} title="Knowledge Agent" badge="RAG" badgeVariant="rca" />
            <AgentErrorContent error={stepError} />
          </>
        );
      case "log-analysis":
        return (
          <>
            <FindingsContent findings={isCurrentRunComplete("log-analysis") ? s.logFindings ?? [] : []} title="Log Analysis" badge="LOG" badgeVariant="p3" />
            <AgentErrorContent error={stepError} />
          </>
        );
      case "metrics":
        return (
          <>
            <FindingsContent findings={isCurrentRunComplete("metrics") ? s.metricFindings ?? [] : []} title="Metrics Analysis" badge="MET" badgeVariant="p2" />
            <AgentErrorContent error={stepError} />
          </>
        );
      case "correlation":
        return (
          <>
            <FindingsContent
              findings={isCurrentRunComplete("correlation") ? s.correlations ?? [] : []}
              title="Correlation Agent"
              badge="CORR"
              badgeVariant="p3"
            />
            <AgentErrorContent error={stepError} />
          </>
        );
      case "rca-generator":
        if (!isCurrentRunComplete("rca-generator") || !s.rca) {
          return (
            <>
              <p className="agent-step__empty">No RCA generated yet.</p>
              <AgentErrorContent error={stepError} />
            </>
          );
        }
        return (
          <>
            <AgentResultCard title="RCA Agent" badge="RCA" badgeVariant="rca">
              <p className="agent-result-card__summary">{typeof s.rca === "string" ? s.rca : JSON.stringify(s.rca, null, 2)}</p>
            </AgentResultCard>
            <AgentErrorContent error={stepError} />
          </>
        );
      default:
        return <p className="agent-step__empty">No data.</p>;
    }
  };

  const openMeta = openKey ? AGENT_META[openKey] : null;

  return (
    <div className="agent-stepper">
      <ol className="agent-stepper__list">
        {uniqueSteps.map((agentId, idx) => {
          const meta = AGENT_META[agentId];
          if (!meta) return null;
          const st = stepStatus(agentId);

          return (
            <li key={agentId} className={`agent-stepper__item agent-stepper__item--${st}`}>
              {idx > 0 && (
                <span className={`agent-stepper__connector ${
                  stepStatus(uniqueSteps[idx - 1]) === "completed" ? "agent-stepper__connector--complete" : ""
                }`} />
              )}
              <button
                type="button"
                className={`agent-stepper__step ${openKey === agentId ? "agent-stepper__step--active" : ""}`}
                onClick={() => setOpenKey(agentId)}
                aria-label={`${meta.label} step`}
              >
                <span className={`agent-stepper__circle agent-stepper__circle--${st}`}>
                  {st === "completed" && <span className="agent-stepper__check">✓</span>}
                  {st === "error"   && <span className="agent-stepper__cross">!</span>}
                  {(st === "running" || st === "pending") && (
                    <span className="agent-stepper__num">{idx + 1}</span>
                  )}
                </span>
                <span className="agent-stepper__label">{meta.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Overlay — covers the chat body */}
      {openKey && openMeta && (
        <div className="agent-stepper__overlay">
          <div className="agent-stepper__overlay-header">
            <span className="agent-stepper__overlay-title">{openMeta.label}</span>
            <button
              type="button"
              className="agent-stepper__overlay-close"
              onClick={() => setOpenKey(null)}
              aria-label="Close overlay"
            >
              ✕
            </button>
          </div>
          <div className="agent-stepper__overlay-body">
            {renderOverlayContent(openKey)}
          </div>
        </div>
      )}
    </div>
  );
}
