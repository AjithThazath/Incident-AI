import './Skeleton.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = '4px', className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
    />
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="stats-card skeleton-card">
      <Skeleton width="40px" height="40px" borderRadius="8px" />
      <div className="stats-card__content">
        <Skeleton width="60px" height="28px" />
        <Skeleton width="100px" height="13px" className="skeleton-mt-8" />
        <Skeleton width="80px" height="12px" className="skeleton-mt-4" />
      </div>
    </div>
  );
}

export function MetricsChartSkeleton() {
  return (
    <div className="metrics-chart skeleton-card">
      <Skeleton width="120px" height="20px" className="skeleton-mb-16" />
      <div className="skeleton-bars">
        <Skeleton width="40px" height="60%" />
        <Skeleton width="40px" height="80%" />
        <Skeleton width="40px" height="40%" />
        <Skeleton width="40px" height="90%" />
      </div>
    </div>
  );
}

export function IncidentTableSkeleton() {
  return (
    <div className="incident-table skeleton-card">
      <div className="incident-table__header">
        <Skeleton width="120px" height="20px" />
        <Skeleton width="60px" height="16px" />
      </div>
      <div className="skeleton-table">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-table-row">
            <Skeleton width="60px" height="14px" />
            <Skeleton width="40px" height="20px" borderRadius="10px" />
            <Skeleton width="200px" height="14px" />
            <Skeleton width="80px" height="20px" borderRadius="10px" />
            <Skeleton width="120px" height="14px" />
            <Skeleton width="50px" height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}
