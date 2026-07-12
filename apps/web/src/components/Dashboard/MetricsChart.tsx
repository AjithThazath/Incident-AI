import './MetricsChart.css';

interface MetricsChartProps {
  title: string;
  data: { label: string; value: number; color: string }[];
  maxValue?: number;
}

export default function MetricsChart({ title, data, maxValue }: MetricsChartProps) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);

  return (
    <div className="metrics-chart">
      <h3 className="metrics-chart__title">{title}</h3>
      <div className="metrics-chart__bars">
        {data.map(item => (
          <div key={item.label} className="metrics-chart__bar-group">
            <div className="metrics-chart__bar-container">
              <div
                className="metrics-chart__bar"
                style={{
                  height: `${(item.value / max) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <div className="metrics-chart__bar-label">{item.label}</div>
            <div className="metrics-chart__bar-value">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
