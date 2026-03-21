type Props = {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
}

export default function MetricCard({ label, value, sub, trend }: Props) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className={`text-xs mt-1 ${trendColor}`}>{sub}</p>}
    </div>
  )
}
