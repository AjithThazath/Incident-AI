import './StatsCard.css';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info';
}

export default function StatsCard({ title, value, subtitle, icon, variant = 'default' }: StatsCardProps) {
  return (
    <div className={`stats-card stats-card--${variant}`}>
      <div className="stats-card__icon">{icon}</div>
      <div className="stats-card__content">
        <div className="stats-card__value">{value}</div>
        <div className="stats-card__title">{title}</div>
        {subtitle && <div className="stats-card__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}
