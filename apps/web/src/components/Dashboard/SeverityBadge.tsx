import type { Severity, IncidentStatus } from '@incidentiq/shared-types';
import './SeverityBadge.css';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md';
}

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  return (
    <span className={`severity-badge severity-badge--${severity.toLowerCase()} severity-badge--${size}`}>
      {severity}
    </span>
  );
}

interface StatusBadgeProps {
  status: IncidentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const labels: Record<IncidentStatus, string> = {
    open: 'Open',
    investigating: 'Investigating',
    mitigated: 'Mitigated',
    resolved: 'Resolved',
    closed: 'Closed',
  };

  return (
    <span className={`status-badge status-badge--${status}`}>
      {labels[status]}
    </span>
  );
}
