import StatsCard from '../components/Dashboard/StatsCard';
import IncidentTable from '../components/Dashboard/IncidentTable';
import MetricsChart from '../components/Dashboard/MetricsChart';
import { StatsCardSkeleton, MetricsChartSkeleton, IncidentTableSkeleton } from '../components/Skeleton/Skeleton';
import { useIncidents } from '../hooks/useIncidents';
import './Dashboard.css';
import { useCopilotReadable } from '@copilotkit/react-core';

export default function Dashboard() {
  const { incidents, summary, loading, initialLoading, page, totalPages, total, goToPage } = useIncidents();  

  if (initialLoading) {
    return (
      <div className="dashboard">
        <div className="dashboard__stats">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <div className="dashboard__charts">
          <MetricsChartSkeleton />
          <MetricsChartSkeleton />
        </div>
        <IncidentTableSkeleton />
      </div>
    );
  }

  const severityData = [
    { label: 'P1', value: summary.totalP1, color: '#ef4444' },
    { label: 'P2', value: summary.totalP2, color: '#f59e0b' },
    { label: 'P3', value: incidents.filter(i => i.severity === 'P3').length, color: '#3b82f6' },
    { label: 'P4', value: incidents.filter(i => i.severity === 'P4').length, color: '#94a3b8' },
  ];

  const statusData = [
    { label: 'Open', value: incidents.filter(i => i.status === 'open').length, color: '#ef4444' },
    { label: 'Investigating', value: incidents.filter(i => i.status === 'investigating').length, color: '#f59e0b' },
    { label: 'Mitigated', value: incidents.filter(i => i.status === 'mitigated').length, color: '#3b82f6' },
    { label: 'Resolved', value: incidents.filter(i => i.status === 'resolved').length, color: '#22c55e' },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard__stats">
        <StatsCard
          icon="🔥"
          title="Open Incidents"
          value={summary.totalOpen}
          variant="danger"
        />
        <StatsCard
          icon="🚨"
          title="Active P1s"
          value={summary.totalP1}
          subtitle="Critical incidents"
          variant="warning"
        />
        <StatsCard
          icon="⏱️"
          title="Avg MTTR"
          value={`${summary.avgMttr}m`}
          subtitle="Mean Time to Resolve"
          variant="info"
        />
        <StatsCard
          icon="📊"
          title="Total Tracked"
          value={incidents.length}
          subtitle="All incidents"
          variant="default"
        />
      </div>

      <div className="dashboard__charts">
        <MetricsChart title="By Severity" data={severityData} />
        <MetricsChart title="By Status" data={statusData} />
      </div>

      <IncidentTable
        incidents={incidents}
        page={page}
        totalPages={totalPages}
        total={total}
        loading={loading}
        onPageChange={goToPage}
      />
    </div>
  );
}
