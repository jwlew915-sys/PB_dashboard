'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, SalesRow } from '@/lib/supabase'
import MetricCard from '@/components/MetricCard'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

type Tab = 'daily' | 'weekly' | 'monthly' | 'ytd' | 'compare'

const fmt = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US')

const fmtK = (n: number) =>
  n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n)

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function endOfWeek(date: Date) {
  const d = new Date(startOfWeek(date))
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('daily')
  const [allData, setAllData] = useState<SalesRow[]>([])
  const [loading, setLoading] = useState(true)

  // Date pickers
  const today = new Date().toISOString().slice(0, 10)
  const [dailyDate, setDailyDate] = useState(today)
  const [weekDate, setWeekDate] = useState(today)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [cmpDate, setCmpDate] = useState(today)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('sales')
        .select('*')
        .order('business_date', { ascending: true })
      setAllData((data as SalesRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── DAILY ──
  const dailyRow = useMemo(() =>
    allData.find(r => r.business_date === dailyDate),
    [allData, dailyDate])

  // ── WEEKLY ──
  const weekFrom = startOfWeek(new Date(weekDate + 'T00:00:00'))
  const weekTo = endOfWeek(new Date(weekDate + 'T00:00:00'))
  const weekRows = useMemo(() =>
    allData.filter(r => r.business_date >= weekFrom && r.business_date <= weekTo),
    [allData, weekFrom, weekTo])
  const weekNet = weekRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const weekOrders = weekRows.reduce((s, r) => s + (r.order_count || 0), 0)

  // ── MONTHLY ──
  const monthRows = useMemo(() =>
    allData.filter(r => r.business_date.startsWith(month)),
    [allData, month])
  const monthNet = monthRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const monthOrders = monthRows.reduce((s, r) => s + (r.order_count || 0), 0)
  const monthAvgDaily = monthRows.length ? monthNet / monthRows.length : 0

  // ── YTD ──
  const ytdRows = useMemo(() =>
    allData.filter(r => r.business_date.startsWith(year)),
    [allData, year])
  const ytdNet = ytdRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const ytdOrders = ytdRows.reduce((s, r) => s + (r.order_count || 0), 0)

  // Monthly breakdown for YTD chart
  const ytdByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    ytdRows.forEach(r => {
      const mo = r.business_date.slice(0, 7)
      map[mo] = (map[mo] || 0) + (r['netsales_$'] || 0)
    })
    return Object.entries(map).sort().map(([mo, net]) => ({
      month: mo.slice(5),
      net: Math.round(net)
    }))
  }, [ytdRows])

  // ── YoY COMPARE ──
  const [cmpY, cmpM, cmpD] = cmpDate.split('-')
  const prevDate = `${parseInt(cmpY) - 1}-${cmpM}-${cmpD}`
  const cmpRowA = useMemo(() => allData.find(r => r.business_date === cmpDate), [allData, cmpDate])
  const cmpRowB = useMemo(() => allData.find(r => r.business_date === prevDate), [allData, prevDate])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'ytd', label: 'YTD' },
    { id: 'compare', label: 'YoY Compare' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-content-center">
              <span className="text-white font-bold text-xs px-1.5">PB</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Paris Baguette</h1>
              <p className="text-xs text-gray-500">FR-1554 · Edison, NJ · 1739 NJ-27</p>
            </div>
          </div>
          <span className="text-xs text-gray-400">{allData.length} days of data</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DAILY ── */}
        {tab === 'daily' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard label="Net Sales" value={dailyRow ? fmt(dailyRow['netsales_$']) : '—'} />
              <MetricCard label="Orders" value={dailyRow ? dailyRow.order_count.toLocaleString() : '—'} />
              <MetricCard label="Avg Order Value" value={dailyRow?.avg_order ? fmt(dailyRow.avg_order) : '—'} />
              <MetricCard label="Date" value={dailyDate} />
            </div>
            {!dailyRow && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                No data found for {dailyDate}. Try a different date.
              </div>
            )}
          </div>
        )}

        {/* ── WEEKLY ── */}
        {tab === 'weekly' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <label className="text-sm text-gray-600">Week containing</label>
              <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
              <span className="text-xs text-gray-400">{weekFrom} → {weekTo}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard label="Net Sales" value={fmt(weekNet)} />
              <MetricCard label="Total Orders" value={weekOrders.toLocaleString()} />
              <MetricCard label="Avg Daily Sales" value={weekRows.length ? fmt(weekNet / weekRows.length) : '—'} />
              <MetricCard label="Days w/ Data" value={weekRows.length.toString()} />
            </div>
            {weekRows.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-700 mb-4">Daily net sales this week</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={weekRows.map(r => ({ date: r.business_date.slice(5), sales: r['netsales_$'] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Net Sales']} />
                    <Bar dataKey="sales" fill="#C8102E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── MONTHLY ── */}
        {tab === 'monthly' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard label="Net Sales" value={fmt(monthNet)} />
              <MetricCard label="Total Orders" value={monthOrders.toLocaleString()} />
              <MetricCard label="Avg Daily Sales" value={fmt(monthAvgDaily)} />
              <MetricCard label="Days w/ Data" value={monthRows.length.toString()} />
            </div>
            {monthRows.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-700 mb-4">Daily sales — {month}</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={monthRows.map(r => ({ date: r.business_date.slice(8), sales: r['netsales_$'], orders: r.order_count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) => [name === 'sales' ? fmt(v) : v.toLocaleString(), name === 'sales' ? 'Net Sales' : 'Orders']} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#C8102E" strokeWidth={2} dot={false} name="sales" />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#94a3b8" strokeWidth={1.5} dot={false} name="orders" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── YTD ── */}
        {tab === 'ytd' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <label className="text-sm text-gray-600">Year</label>
              <input type="number" value={year} onChange={e => setYear(e.target.value)}
                min="2020" max="2030"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white w-24 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard label="YTD Net Sales" value={fmt(ytdNet)} />
              <MetricCard label="YTD Orders" value={ytdOrders.toLocaleString()} />
              <MetricCard label="Avg Daily Sales" value={ytdRows.length ? fmt(ytdNet / ytdRows.length) : '—'} />
              <MetricCard label="Days w/ Data" value={ytdRows.length.toString()} />
            </div>
            {ytdByMonth.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-4">Monthly net sales — {year}</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ytdByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Net Sales']} />
                    <Bar dataKey="net" fill="#C8102E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Day of week breakdown */}
            {ytdRows.length > 0 && (() => {
              const dowMap: Record<string, { total: number; count: number }> = {}
              const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
              ytdRows.forEach(r => {
                const dow = days[new Date(r.business_date + 'T00:00:00').getDay()]
                if (!dowMap[dow]) dowMap[dow] = { total: 0, count: 0 }
                dowMap[dow].total += r['netsales_$'] || 0
                dowMap[dow].count++
              })
              const dowData = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => ({
                day: d,
                avg: dowMap[d] ? Math.round(dowMap[d].total / dowMap[d].count) : 0
              }))
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm font-medium text-gray-700 mb-4">Average sales by day of week</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [fmt(v), 'Avg Sales']} />
                      <Bar dataKey="avg" fill="#1a1a2e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── YoY COMPARE ── */}
        {tab === 'compare' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <label className="text-sm text-gray-600">Compare date</label>
              <input type="date" value={cmpDate} onChange={e => setCmpDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              {/* This year */}
              <div className="bg-white rounded-xl border-2 border-red-200 p-5">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">{cmpDate}</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Net Sales" value={cmpRowA ? fmt(cmpRowA['netsales_$']) : 'No data'} />
                  <MetricCard label="Orders" value={cmpRowA ? cmpRowA.order_count.toLocaleString() : 'No data'} />
                  <MetricCard label="Avg Order" value={cmpRowA?.avg_order ? fmt(cmpRowA.avg_order) : '—'} />
                  <MetricCard label="Year" value={cmpY} />
                </div>
              </div>
              {/* Prior year */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{prevDate} (prior year)</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Net Sales" value={cmpRowB ? fmt(cmpRowB['netsales_$']) : 'No data'} />
                  <MetricCard label="Orders" value={cmpRowB ? cmpRowB.order_count.toLocaleString() : 'No data'} />
                  <MetricCard label="Avg Order" value={cmpRowB?.avg_order ? fmt(cmpRowB.avg_order) : '—'} />
                  <MetricCard label="Year" value={(parseInt(cmpY) - 1).toString()} />
                </div>
              </div>
            </div>
            {/* Side by side bar */}
            {(cmpRowA || cmpRowB) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-700 mb-4">Sales & orders comparison</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[
                    { label: 'Net Sales', thisYear: cmpRowA?.['netsales_$'] || 0, priorYear: cmpRowB?.['netsales_$'] || 0 },
                    { label: 'Orders', thisYear: cmpRowA?.order_count || 0, priorYear: cmpRowB?.order_count || 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="thisYear" name={cmpDate} fill="#C8102E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="priorYear" name={prevDate} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* YoY change callout */}
            {cmpRowA && cmpRowB && (
              <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-700 mb-3">Year-over-year change</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Net Sales', a: cmpRowA['netsales_$'], b: cmpRowB['netsales_$'], isCurrency: true },
                    { label: 'Orders', a: cmpRowA.order_count, b: cmpRowB.order_count, isCurrency: false },
                  ].map(({ label, a, b, isCurrency }) => {
                    const pct = b ? ((a - b) / b * 100) : 0
                    const up = pct >= 0
                    return (
                      <div key={label} className={`rounded-lg p-4 ${up ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        <p className={`text-xl font-semibold ${up ? 'text-green-700' : 'text-red-700'}`}>
                          {up ? '+' : ''}{pct.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {isCurrency ? fmt(a - b) : (a - b > 0 ? '+' : '') + (a - b).toLocaleString()} vs prior year
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
