import { useNavigate } from 'react-router-dom';
import type { Incident } from '@incidentiq/shared-types';
import { SeverityBadge, StatusBadge } from './SeverityBadge';
import './IncidentTable.css';

interface IncidentTableProps {
  incidents: Incident[];
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export default function IncidentTable({
  incidents,
  page,
  totalPages,
  total,
  loading,
  onPageChange,
}: IncidentTableProps) {
  const navigate = useNavigate();

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="incident-table">
      <div className="incident-table__header">
        <h3 className="incident-table__title">All Incidents</h3>
        <span className="incident-table__count">{total} total</span>
      </div>
      <table className="incident-table__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Severity</th>
            <th>Title</th>
            <th>Status</th>
            <th>Services</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map(incident => (
            <tr
              key={incident.id}
              className="incident-table__row"
              onClick={() => navigate(`/incidents/${incident.incidentId}`)}
            >
              <td className="incident-table__id">{incident.incidentId}</td>
              <td><SeverityBadge severity={incident.severity} size="sm" /></td>
              <td className="incident-table__title-cell">{incident.title}</td>
              <td><StatusBadge status={incident.status} /></td>
              <td className="incident-table__services">
                {incident.affectedServices.slice(0, 2).map(s => (
                  <span key={s} className="incident-table__service-tag">{s}</span>
                ))}
                {incident.affectedServices.length > 2 && (
                  <span className="incident-table__service-tag">+{incident.affectedServices.length - 2}</span>
                )}
              </td>
              <td className="incident-table__time">{formatTime(incident.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="incident-table__pagination">
          <button
            className="incident-table__page-btn"
            onClick={() => onPageChange(1)}
            disabled={page === 1 || loading}
          >
            «
          </button>
          <button
            className="incident-table__page-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || loading}
          >
            ‹
          </button>
          <span className="incident-table__page-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="incident-table__page-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages || loading}
          >
            ›
          </button>
          <button
            className="incident-table__page-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages || loading}
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
