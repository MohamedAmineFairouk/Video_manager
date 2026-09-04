export default function BarChart({ data, height = 140, color = '#38bdf8', valueSuffix = '' }) {
  if (!data || data.length === 0) {
    return <div className="empty-state" style={{ padding: '12px 0' }}>Pas encore de données.</div>
  }

  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0))
  const barWidth = 100 / data.length
  const stride = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div className="bar-chart">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="bar-chart-svg" style={{ height }}>
        {data.map((d, i) => {
          const value = Number(d.value) || 0
          const barHeight = max > 0 ? (value / max) * (height - 6) : 0
          return (
            <rect
              key={i}
              x={i * barWidth + barWidth * 0.15}
              y={height - barHeight}
              width={barWidth * 0.7}
              height={barHeight}
              rx="1"
              fill={color}
            >
              <title>{d.label}: {value}{valueSuffix}</title>
            </rect>
          )
        })}
      </svg>
      <div className="bar-chart-labels">
        {data.map((d, i) => (
          i % stride === 0
            ? <span key={i} className="bar-chart-label" style={{ width: `${barWidth * stride}%` }}>{d.label}</span>
            : null
        ))}
      </div>
    </div>
  )
}
