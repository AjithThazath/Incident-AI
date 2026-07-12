import { useRenderTool } from "@copilotkit/react-core/v2";
import "./ToolRenderers.css";

type ToolStatus = "executing" | "complete" | "error" | string;

function prettifyKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function serializeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ToolPayloadSection({ title, data }: { title: string; data: unknown }) {
  if (data == null) return null;

  const isObject = typeof data === "object" && !Array.isArray(data);

  return (
    <section className="tool-card__section">
      <h5 className="tool-card__section-title">{title}</h5>
      {isObject ? (
        <dl className="tool-card__kv-list">
          {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
            <div className="tool-card__kv-item" key={key}>
              <dt>{prettifyKey(key)}</dt>
              <dd>
                <pre>{serializeValue(value)}</pre>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre className="tool-card__raw">{serializeValue(data)}</pre>
      )}
    </section>
  );
}

function GenericToolCard({
  agentName,
  toolName,
  status,
  args,
  result,
}: {
  agentName: string;
  toolName: string;
  status: ToolStatus;
  args: unknown;
  result: unknown;
}) {
  const isRunning = status === "executing";
  const showResult = status === "complete" || status === "error";

  return (
    <article
      className={`tool-card ${isRunning ? "tool-card--running" : ""}`}
      aria-busy={isRunning}
    >
      <header className="tool-card__header">
        <h4 className="tool-card__title">{agentName}</h4>
        <span className={`tool-card__status tool-card__status--${status}`}>{status}</span>
      </header>

      <p className="tool-card__subtitle">Tool: {toolName}</p>
      <ToolPayloadSection title="Parameters" data={args} />
      {showResult ? <ToolPayloadSection title="Result" data={result} /> : null}

      {isRunning ? (
        <div className="tool-card__running-row">
          <span className="tool-card__dot" />
          <span>Running tool...</span>
        </div>
      ) : null}
    </article>
  );
}

function getAgentName(props: Record<string, unknown>, toolName: string): string {
  const possible = [
    props.agentName,
    props.agent,
    props.agentId,
    props.graphId,
    props.nodeName,
  ];
  for (const value of possible) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  if (toolName.trim().length > 0) {
    return `Agent Tool: ${toolName}`;
  }

  return "Agent Tool";
}

export function ToolRenderers() {
  useRenderTool({
    name: "*",
    render: (props: Record<string, unknown>) => {
      const toolName = typeof props.name === "string" ? props.name : "unknown_tool";
      const status = typeof props.status === "string" ? props.status : "executing";

      return (
        <GenericToolCard
          agentName={getAgentName(props, toolName)}
          toolName={toolName}
          status={status}
          args={props.args}
          result={props.result}
        />
      );
    },
  });

  return null;
}
