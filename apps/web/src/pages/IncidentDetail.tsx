import { useParams, useNavigate } from "react-router-dom";
import { useIncidentDetail } from "../hooks/useIncidents";
import {
  SeverityBadge,
  StatusBadge,
} from "../components/Dashboard/SeverityBadge";
import { Skeleton } from "../components/Skeleton/Skeleton";
import "./IncidentDetail.css";
import { useCopilotReadable } from "@copilotkit/react-core";
import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { useCopilotTrigger } from '../components/CopilotKit/CopilotTriggerContext';

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { incident, loading } = useIncidentDetail(id);
  const { setIsOpen } = useCopilotTrigger();
  const { appendMessage } = useCopilotChat();

  useCopilotReadable({
    description: "The incident currently being viewed by the user",
    value: incident ? JSON.stringify(incident) : "",
  });

  const handleAnalyze = () => {
    setIsOpen(true);
    appendMessage(new TextMessage({
      role: Role.User,
      content: `Analyze this incident`,
    }));
  };

  if (loading) {
    return (
      <div className="incident-detail">
        <div className="incident-detail__header">
          <div className="incident-detail__header-top">
            <Skeleton width="60px" height="16px" />
            <Skeleton width="80px" height="16px" />
          </div>
          <Skeleton width="300px" height="28px" />
          <div className="incident-detail__badges">
            <Skeleton width="50px" height="22px" borderRadius="10px" />
            <Skeleton width="80px" height="22px" borderRadius="10px" />
          </div>
        </div>
        <div className="incident-detail__grid">
          <div className="incident-detail__section">
            <Skeleton width="100px" height="18px" className="skeleton-mb-16" />
            <Skeleton width="100%" height="14px" />
            <Skeleton width="80%" height="14px" className="skeleton-mt-8" />
          </div>
          <div className="incident-detail__section">
            <Skeleton width="140px" height="18px" className="skeleton-mb-16" />
            <div style={{ display: "flex", gap: "8px" }}>
              <Skeleton width="90px" height="24px" borderRadius="12px" />
              <Skeleton width="110px" height="24px" borderRadius="12px" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="incident-detail__not-found">
        <h2>Incident not found</h2>
        <p>No incident found with ID: {id}</p>
        <button onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="incident-detail">
      <div className="incident-detail__header">
        <div className="incident-detail__header-top">
          <button
            className="incident-detail__back"
            onClick={() => navigate("/dashboard")}
          >
            ← Back
          </button>
          <span className="incident-detail__id">{incident.incidentId}</span>
        </div>
        <h1 className="incident-detail__title">{incident.title}</h1>
        <div className="incident-detail__badges">
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>
      </div>

      <div className="incident-detail__grid">
        <div className="incident-detail__section">
          <h3>Description</h3>
          <p>{incident.description}</p>
        </div>

        <div className="incident-detail__section">
          <h3>Affected Services</h3>
          <div className="incident-detail__services">
            {incident.affectedServices.map((s) => (
              <span key={s} className="incident-detail__service-tag">
                {s}
              </span>
            ))}
          </div>
        </div>

        {incident.rootCause && (
          <div className="incident-detail__section">
            <h3>Root Cause</h3>
            <p>{incident.rootCause}</p>
          </div>
        )}

        {incident.resolution && (
          <div className="incident-detail__section">
            <h3>Resolution</h3>
            <p>{incident.resolution}</p>
          </div>
        )}

        <div className="incident-detail__section">
          <h3>Timeline</h3>
          <div className="incident-detail__timeline">
            <div className="incident-detail__event">
              <span className="incident-detail__event-time">
                {new Date(incident.createdAt).toLocaleString()}
              </span>
              <span className="incident-detail__event-text">
                Incident created
              </span>
            </div>
            <div className="incident-detail__event">
              <span className="incident-detail__event-time">
                {new Date(incident.updatedAt).toLocaleString()}
              </span>
              <span className="incident-detail__event-text">Last updated</span>
            </div>
            {incident.resolvedAt && (
              <div className="incident-detail__event">
                <span className="incident-detail__event-time">
                  {new Date(incident.resolvedAt).toLocaleString()}
                </span>
                <span className="incident-detail__event-text">Resolved</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="incident-detail__actions">
        <button
          className="incident-detail__analyze-btn"
          onClick={handleAnalyze}
        >
          🤖 Analyze with AI
        </button>
      </div>
    </div>
  );
}
