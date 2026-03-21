'use client'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { SalesRow } from '@/lib/supabase'

function fmtK(n: number) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'k'
  return '$' + Math.round(n)
}

type Props = {
  data: SalesRow[]
  type?: 'bar' | 'line'
  height?: number
  compareData?: { date: string; value: number; label: string }[]
}

export default function SalesChart({ data, type = 'bar', height = 220, compareData }: Props) {
  const chartData = data.map(r => ({
    date: r.business_date.slice(5),
    sales: Math.round(r['netsales_$'] || 0),
    orders: r.order_count || 0,
  }))

  if (compareData) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={[
          { name: compareData[0]?.label || 'This year', value: compareData[0]?.value || 0 },
          { name: compareData[1]?.label || 'Prior year', value: compareData[1]?.value || 0 },
        ]} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0efeb" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => ['$' + v.toLocaleString(), 'Net Sales']} />
          <Bar dataKey="value" fill="#1a56db" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0efeb" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => ['$' + v.toLocaleString(), 'Net Sales']} />
          <Line type="monotone" dataKey="sales" stroke="#1a56db" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0efeb" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => ['$' + v.toLocaleString(), 'Net Sales']} />
        <Bar dataKey="sales" fill="#1a56db" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
