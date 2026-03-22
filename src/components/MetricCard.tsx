type Props = {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  badge?: string
  badgeColor?: 'blue' | 'rosy' | 'sand'
  large?: boolean
}

export default function MetricCard({ label, value, sub, trend, badge, badgeColor = 'blue', large }: Props) {
  const trendColor =
    trend === 'up' ? '#2E7D52' :
    trend === 'down' ? '#C0392B' :
    'var(--text-muted)'

  const badgeBg =
    badgeColor === 'rosy' ? { background: 'rgba(215, 104, 132, 0.12)', color: '#B5405A' } :
    badgeColor === 'sand' ? { background: 'rgba(208, 178, 131, 0.2)', color: '#7A5C30' } :
    { background: 'rgba(34, 92, 194, 0.1)', color: 'var(--blue)' }

  return (
    <div
      style={{
        background: 'var(--bg-card-alt)',
        border: '1.5px solid var(--border-soft)',
        borderRadius: 'var(--radius-card)',
        padding: large ? '28px 26px' : '22px 24px',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <p style={{
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-label)',
        }}>
          {label}
        </p>
        {badge && (
          <span style={{
            fontFamily: 'var(--font-body), sans-serif',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '3px 9px',
            borderRadius: 20,
            ...badgeBg,
          }}>
            {badge}
          </span>
        )}
      </div>
      <p style={{
        fontFamily: 'var(--font-display), serif',
        fontSize: large ? '52px' : '38px',
        lineHeight: 1.0,
        color: 'var(--navy)',
        letterSpacing: '-0.01em',
      }}>
        {value}
      </p>
      {sub && (
        <p style={{
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: '12px',
          fontWeight: 500,
          color: trendColor,
          marginTop: 2,
        }}>
          {sub}
        </p>
      )}
    </div>
  )
}
