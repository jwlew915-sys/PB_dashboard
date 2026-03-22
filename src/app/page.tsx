'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, SalesRow, MenuRow } from '@/lib/supabase'
import { calcWaste, groupSalesByDate } from '@/lib/data'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type Tab = 'daily' | 'weekly' | 'monthly' | 'ytd' | 'compare'

const fmt  = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const fmtK = (n: number) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n)
const norm = (d: string) => String(d).slice(0, 10)

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
function endOfWeek(date: Date) {
  const d = new Date(startOfWeek(date))
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}
function shiftDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Trend badge ────────────────────────────────────────────────────────────────
function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontFamily: 'var(--font-body), sans-serif',
      fontSize: '11px', fontWeight: 700,
      color: up ? '#2E7D52' : '#C0392B',
      background: up ? 'rgba(46,125,82,0.1)' : 'rgba(192,57,43,0.1)',
      padding: '2px 8px', borderRadius: 20,
    }}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
type KpiProps = {
  label: string; value: string; sub: string; trend: number | null; highlight?: boolean
}
function KpiCard({ label, value, sub, trend, highlight }: KpiProps) {
  return (
    <div style={{
      background: highlight ? 'var(--navy)' : 'var(--bg-card-alt)',
      border: highlight ? 'none' : '1.5px solid var(--border-soft)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      padding: '22px 24px',
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* decorative arc */}
      {highlight && (
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 110, height: 110, borderRadius: '50%',
          border: '20px solid rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          color: highlight ? 'rgba(255,255,255,0.6)' : 'var(--text-label)',
        }}>{label}</p>
        <span style={{
          fontSize: '16px', opacity: 0.4,
          color: highlight ? '#fff' : 'var(--text-label)',
        }}>↗</span>
      </div>
      <p style={{
        fontFamily: 'var(--font-display), serif',
        fontSize: '34px', lineHeight: 1, letterSpacing: '-0.01em',
        color: highlight ? '#fff' : 'var(--navy)',
      }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {highlight
          ? <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              {trend !== null ? `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}% ` : ''}{sub}
            </span>
          : <><Trend pct={trend} /><span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</span></>
        }
      </div>
    </div>
  )
}

// ── Waste table ────────────────────────────────────────────────────────────────
type WasteItem = { name: string; qty: number; value: number; cogs: number; pct: number }
function WasteTable({ items }: { items: WasteItem[] }) {
  if (!items.length) return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-muted)', padding: '20px 0' }}>
      No waste data for this period.
    </p>
  )
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {['Item', 'Waste Qty', 'Waste %', 'Retail Value'].map(h => (
            <th key={h} style={{
              fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-label)', textAlign: h === 'Item' ? 'left' : 'right',
              paddingBottom: 10, borderBottom: '1.5px solid var(--border-soft)',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '13px', color: 'var(--navy)', padding: '11px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--oat)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🥐</div>
                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              </div>
            </td>
            <td style={{ textAlign: 'right', fontSize: '13px', fontWeight: 500, color: 'var(--text-body)', padding: '11px 0', borderBottom: '1px solid var(--border-soft)' }}>
              {item.qty.toFixed(1)}
            </td>
            <td style={{ textAlign: 'right', padding: '11px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <span style={{
                background: item.pct > 20 ? 'rgba(215,104,132,0.12)' : 'rgba(34,92,194,0.08)',
                color: item.pct > 20 ? '#B5405A' : 'var(--blue)',
                borderRadius: 20, padding: '2px 9px',
                fontWeight: 700, fontSize: '11px',
                fontFamily: 'var(--font-body)',
              }}>{item.pct.toFixed(1)}%</span>
            </td>
            <td style={{ textAlign: 'right', fontSize: '13px', fontWeight: 500, color: 'var(--text-body)', padding: '11px 0', borderBottom: '1px solid var(--border-soft)' }}>
              {fmt(item.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Sidebar nav item ──────────────────────────────────────────────────────────
const NAV = [
  { id: 'daily',   label: 'Daily',   icon: '◈' },
  { id: 'weekly',  label: 'Weekly',  icon: '▦' },
  { id: 'monthly', label: 'Monthly', icon: '▤' },
  { id: 'ytd',     label: 'YTD',     icon: '◉' },
  { id: 'compare', label: 'YoY Compare', icon: '⇄' },
]

const C = {
  blue: '#225CC2', blueMid: '#3B74D9',
  sand: '#D0B283', sandLight: '#E8D4B0',
  grid: 'rgba(208,178,131,0.18)', tick: '#9A8A98',
}
const axisProps = {
  tick: { fontSize: 10, fill: C.tick, fontFamily: 'var(--font-body)' },
  axisLine: false as const, tickLine: false as const,
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab]         = useState<Tab>('daily')
  const [allData, setAllData] = useState<SalesRow[]>([])
  const [allMenu, setAllMenu] = useState<MenuRow[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0, 10)
  const [dailyDate, setDailyDate] = useState(today)
  const [weekDate,  setWeekDate]  = useState(today)
  const [month,     setMonth]     = useState(today.slice(0, 7))
  const [year,      setYear]      = useState(new Date().getFullYear().toString())
  const [cmpDate,   setCmpDate]   = useState(today)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [salesRes, menuRes] = await Promise.all([
        supabase.from('sales').select('*').order('business_date', { ascending: true }),
        supabase.from('menu').select('*').order('business_date', { ascending: true }),
      ])
      setAllData(groupSalesByDate((salesRes.data as SalesRow[]) || []))
      setAllMenu((menuRes.data as MenuRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── DAILY ──
  const sameDayPriorYear = useMemo(() => {
    const d = new Date(dailyDate + 'T00:00:00')
    d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 10)
  }, [dailyDate])
  const dailyRow      = useMemo(() => allData.find(r => norm(r.business_date) === dailyDate),        [allData, dailyDate])
  const prevDayRow    = useMemo(() => allData.find(r => norm(r.business_date) === sameDayPriorYear), [allData, sameDayPriorYear])
  const dailyMenuRows = useMemo(() => allMenu.filter(r => norm(r.business_date) === dailyDate), [allMenu, dailyDate])
  const last14        = useMemo(() => {
    const start = shiftDays(dailyDate, -13)
    return allData.filter(r => norm(r.business_date) >= start && norm(r.business_date) <= dailyDate)
  }, [allData, dailyDate])

  // ── WEEKLY ──
  const weekFrom     = startOfWeek(new Date(weekDate + 'T00:00:00'))
  const weekTo       = endOfWeek(new Date(weekDate + 'T00:00:00'))
  const prevWeekFrom = shiftDays(weekFrom, -7)
  const prevWeekTo   = shiftDays(weekTo, -7)
  const weekRows     = useMemo(() => allData.filter(r => norm(r.business_date) >= weekFrom && norm(r.business_date) <= weekTo), [allData, weekFrom, weekTo])
  const prevWeekRows = useMemo(() => allData.filter(r => norm(r.business_date) >= prevWeekFrom && norm(r.business_date) <= prevWeekTo), [allData, prevWeekFrom, prevWeekTo])
  const weekMenuRows = useMemo(() => allMenu.filter(r => norm(r.business_date) >= weekFrom && norm(r.business_date) <= weekTo), [allMenu, weekFrom, weekTo])
  const weekNet      = weekRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const weekOrders   = weekRows.reduce((s, r) => s + (r.order_count   || 0), 0)
  const prevWeekNet  = prevWeekRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const prevWeekOrd  = prevWeekRows.reduce((s, r) => s + (r.order_count   || 0), 0)

  // ── MONTHLY ──
  const [mY, mM]      = month.split('-').map(Number)
  const prevMonth     = `${mM === 1 ? mY - 1 : mY}-${String(mM === 1 ? 12 : mM - 1).padStart(2, '0')}`
  const monthRows     = useMemo(() => allData.filter(r => norm(r.business_date).startsWith(month)),     [allData, month])
  const prevMonthRows = useMemo(() => allData.filter(r => norm(r.business_date).startsWith(prevMonth)), [allData, prevMonth])
  const monthMenuRows = useMemo(() => allMenu.filter(r => norm(r.business_date).startsWith(month)),     [allMenu, month])
  const monthNet      = monthRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const monthOrders   = monthRows.reduce((s, r) => s + (r.order_count   || 0), 0)
  const prevMonthNet  = prevMonthRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const prevMonthOrd  = prevMonthRows.reduce((s, r) => s + (r.order_count   || 0), 0)
  const monthAvgDaily = monthRows.length ? monthNet / monthRows.length : 0

  // ── YTD ──
  const ytdRows     = useMemo(() => allData.filter(r => norm(r.business_date).startsWith(year)),            [allData, year])
  const ytdMenuRows = useMemo(() => allMenu.filter(r => norm(r.business_date).startsWith(year)),            [allMenu, year])
  const prevYtdRows = useMemo(() => allData.filter(r => norm(r.business_date).startsWith(String(parseInt(year) - 1))), [allData, year])
  const ytdNet      = ytdRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const ytdOrders   = ytdRows.reduce((s, r) => s + (r.order_count   || 0), 0)
  const prevYtdNet  = prevYtdRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const prevYtdOrd  = prevYtdRows.reduce((s, r) => s + (r.order_count   || 0), 0)

  const ytdByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    ytdRows.forEach(r => { const mo = norm(r.business_date).slice(0, 7); map[mo] = (map[mo] || 0) + (r['netsales_$'] || 0) })
    return Object.entries(map).sort().map(([mo, net]) => ({ month: mo.slice(5), net: Math.round(net) }))
  }, [ytdRows])

  const dowData = useMemo(() => {
    const src = tab === 'ytd' ? ytdRows : weekRows
    const dowMap: Record<string, { total: number; count: number }> = {}
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    src.forEach(r => {
      const dow = dayNames[new Date(norm(r.business_date) + 'T00:00:00').getDay()]
      if (!dowMap[dow]) dowMap[dow] = { total: 0, count: 0 }
      dowMap[dow].total += r['netsales_$'] || 0
      dowMap[dow].count++
    })
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => ({
      day: d, avg: dowMap[d] ? Math.round(dowMap[d].total / dowMap[d].count) : 0,
    }))
  }, [ytdRows, weekRows, tab])

  // ── YoY ──
  const [cmpY, cmpM, cmpD] = cmpDate.split('-')
  const prevDate = `${parseInt(cmpY) - 1}-${cmpM}-${cmpD}`
  const cmpRowA  = useMemo(() => allData.find(r => norm(r.business_date) === cmpDate),  [allData, cmpDate])
  const cmpRowB  = useMemo(() => allData.find(r => norm(r.business_date) === prevDate), [allData, prevDate])

  // ── Current month progress (sidebar) ──
  const curMonth      = today.slice(0, 7)
  const curMonthRows  = useMemo(() => allData.filter(r => norm(r.business_date).startsWith(curMonth)), [allData, curMonth])
  const curMonthSales = curMonthRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const curMonthGoal  = curMonthSales > 0 ? curMonthSales * (30 / Math.max(curMonthRows.length, 1)) : 0

  // ── Trend helpers ──
  const trendPct = (curr: number, prev: number) => prev > 0 ? (curr - prev) / prev * 100 : null

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', flexDirection: 'column', gap: 18 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: '2.5px solid var(--sand-light)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Loading</p>
      </div>
    )
  }

  // ── Per-tab derived values ─────────────────────────────────────────────────
  const periodLabel = {
    daily: dailyDate, weekly: `${weekFrom} → ${weekTo}`,
    monthly: month, ytd: year, compare: `${cmpDate} vs ${prevDate}`,
  }[tab]

  type KpiConfig = { label: string; value: string; sub: string; trend: number | null; highlight?: boolean }

  const kpis: KpiConfig[] = tab === 'daily' ? [
    { label: 'Net Sales', value: dailyRow ? fmt(dailyRow['netsales_$']) : '—', sub: `vs ${sameDayPriorYear}`, trend: trendPct(dailyRow?.['netsales_$'] ?? 0, prevDayRow?.['netsales_$'] ?? 0), highlight: true },
    { label: 'Orders', value: dailyRow ? dailyRow.order_count.toLocaleString() : '—', sub: `vs ${sameDayPriorYear}`, trend: trendPct(dailyRow?.order_count ?? 0, prevDayRow?.order_count ?? 0) },
    { label: 'Avg Order', value: dailyRow?.avg_order ? fmt(dailyRow.avg_order) : '—', sub: 'per transaction', trend: null },
    { label: 'Waste %', value: dailyMenuRows.length ? calcWaste(dailyMenuRows).wastePct.toFixed(1) + '%' : '—', sub: 'of total inventory', trend: null },
  ] : tab === 'weekly' ? [
    { label: 'Net Sales', value: fmt(weekNet), sub: 'vs last week', trend: trendPct(weekNet, prevWeekNet), highlight: true },
    { label: 'Total Orders', value: weekOrders.toLocaleString(), sub: 'vs last week', trend: trendPct(weekOrders, prevWeekOrd) },
    { label: 'Avg Daily', value: weekRows.length ? fmt(weekNet / weekRows.length) : '—', sub: 'daily average', trend: null },
    { label: 'Waste %', value: weekMenuRows.length ? calcWaste(weekMenuRows).wastePct.toFixed(1) + '%' : '—', sub: 'of total inventory', trend: null },
  ] : tab === 'monthly' ? [
    { label: 'Net Sales', value: fmt(monthNet), sub: 'vs last month', trend: trendPct(monthNet, prevMonthNet), highlight: true },
    { label: 'Total Orders', value: monthOrders.toLocaleString(), sub: 'vs last month', trend: trendPct(monthOrders, prevMonthOrd) },
    { label: 'Avg Daily', value: fmt(monthAvgDaily), sub: 'daily average', trend: null },
    { label: 'Waste %', value: monthMenuRows.length ? calcWaste(monthMenuRows).wastePct.toFixed(1) + '%' : '—', sub: 'of total inventory', trend: null },
  ] : tab === 'ytd' ? [
    { label: 'YTD Net Sales', value: fmt(ytdNet), sub: 'vs prior year', trend: trendPct(ytdNet, prevYtdNet), highlight: true },
    { label: 'YTD Orders', value: ytdOrders.toLocaleString(), sub: 'vs prior year', trend: trendPct(ytdOrders, prevYtdOrd) },
    { label: 'Avg Daily', value: ytdRows.length ? fmt(ytdNet / ytdRows.length) : '—', sub: 'daily average', trend: null },
    { label: 'Waste %', value: ytdMenuRows.length ? calcWaste(ytdMenuRows).wastePct.toFixed(1) + '%' : '—', sub: 'of total inventory', trend: null },
  ] : [
    { label: 'This Year Sales', value: cmpRowA ? fmt(cmpRowA['netsales_$']) : '—', sub: cmpDate, trend: trendPct(cmpRowA?.['netsales_$'] ?? 0, cmpRowB?.['netsales_$'] ?? 0), highlight: true },
    { label: 'Prior Year Sales', value: cmpRowB ? fmt(cmpRowB['netsales_$']) : '—', sub: prevDate, trend: null },
    { label: 'Sales Change', value: (cmpRowA && cmpRowB) ? ((cmpRowA['netsales_$'] - cmpRowB['netsales_$']) / cmpRowB['netsales_$'] * 100).toFixed(1) + '%' : '—', sub: 'year-over-year', trend: trendPct(cmpRowA?.['netsales_$'] ?? 0, cmpRowB?.['netsales_$'] ?? 0) },
    { label: 'Orders Change', value: (cmpRowA && cmpRowB) ? ((cmpRowA.order_count - cmpRowB.order_count) / cmpRowB.order_count * 100).toFixed(1) + '%' : '—', sub: 'year-over-year', trend: trendPct(cmpRowA?.order_count ?? 0, cmpRowB?.order_count ?? 0) },
  ]

  const activeMenuRows = tab === 'daily' ? dailyMenuRows : tab === 'weekly' ? weekMenuRows : tab === 'monthly' ? monthMenuRows : ytdMenuRows
  const wasteData = activeMenuRows.length ? calcWaste(activeMenuRows) : null

  // Chart data
  const mainChartData = tab === 'daily'
    ? last14.map(r => ({ date: norm(r.business_date).slice(5), sales: r['netsales_$'], orders: r.order_count }))
    : tab === 'weekly'
    ? weekRows.map(r => ({ date: norm(r.business_date).slice(5), sales: r['netsales_$'], orders: r.order_count }))
    : tab === 'monthly'
    ? monthRows.map(r => ({ date: norm(r.business_date).slice(8), sales: r['netsales_$'], orders: r.order_count }))
    : ytdByMonth.map(r => ({ date: r.month, sales: r.net, orders: 0 }))

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-card-alt)', border: '1.5px solid var(--border)',
    borderRadius: 10, color: 'var(--navy)',
    fontFamily: 'var(--font-body), sans-serif', fontSize: '13px', fontWeight: 500,
    padding: '7px 13px', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>

      {/* ─────────────── SIDEBAR ─────────────── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: 'var(--navy)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'var(--rosy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--font-display), serif', fontSize: '17px', color: '#fff', fontStyle: 'italic' }}>PB</span>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Paris Baguette</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>FR-1554 · Edison, NJ</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 16px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', borderRadius: 10,
            padding: '8px 12px',
          }}>
            <span style={{ fontSize: '13px', opacity: 0.4, color: '#fff' }}>🔍</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Search...</span>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '8px 12px', flex: 1 }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)', padding: '8px 8px 6px',
          }}>Analytics</p>
          {NAV.map(item => {
            const active = tab === item.id
            return (
              <button key={item.id} onClick={() => setTab(item.id as Tab)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', cursor: 'pointer',
                marginBottom: 2,
                transition: 'background 0.15s',
              }}>
                <span style={{ fontSize: '14px', opacity: active ? 1 : 0.4, color: active ? 'var(--rosy)' : '#fff' }}>{item.icon}</span>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: active ? 600 : 400,
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                }}>{item.label}</span>
                {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--rosy)' }} />}
              </button>
            )
          })}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '12px 8px' }} />
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)', padding: '8px 8px 6px',
          }}>Store</p>
          {[{ icon: '⚙', label: 'Settings' }, { icon: '?', label: 'Help Center' }].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, marginBottom: 2,
              opacity: 0.45,
            }}>
              <span style={{ fontSize: '14px', color: '#fff' }}>{item.icon}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#fff' }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Monthly goal */}
        <div style={{
          margin: '0 12px 20px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 14, padding: '16px',
        }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            Monthly Progress
          </p>
          <p style={{ fontFamily: 'var(--font-display), serif', fontSize: '20px', color: '#fff', lineHeight: 1, marginBottom: 4 }}>
            {fmt(curMonthSales)}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            / {fmt(curMonthGoal)} est. goal
          </p>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'var(--rosy)',
              width: curMonthGoal > 0 ? `${Math.min(100, curMonthSales / curMonthGoal * 100)}%` : '0%',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
            {allData.length} days tracked total
          </p>
        </div>
      </aside>

      {/* ─────────────── MAIN CONTENT ─────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 32px 16px',
          borderBottom: '1.5px solid var(--border-soft)',
          background: 'var(--cream)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Sales Overview
            </p>
            <h1 style={{ fontFamily: 'var(--font-display), serif', fontSize: '26px', color: 'var(--navy)', lineHeight: 1 }}>
              {NAV.find(n => n.id === tab)?.label}
            </h1>
          </div>

          {/* Period picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tab === 'daily' && <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} style={inputStyle} />}
            {tab === 'weekly' && (
              <>
                <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} style={inputStyle} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(208,178,131,0.18)', padding: '6px 12px', borderRadius: 8 }}>
                  {weekFrom.slice(5)} → {weekTo.slice(5)}
                </span>
              </>
            )}
            {tab === 'monthly' && <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inputStyle} />}
            {tab === 'ytd'     && <input type="number" value={year} onChange={e => setYear(e.target.value)} min="2020" max="2030" style={{ ...inputStyle, width: 88 }} />}
            {tab === 'compare' && <input type="date" value={cmpDate} onChange={e => setCmpDate(e.target.value)} style={inputStyle} />}
          </div>
        </div>

        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── KPI CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
          </div>

          {/* ── CHARTS ROW ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

            {/* Main chart */}
            <div style={{
              background: 'var(--bg-card-alt)', border: '1.5px solid var(--border-soft)',
              borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '22px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-label)', marginBottom: 4 }}>
                    {tab === 'ytd' ? 'Monthly Net Sales' : tab === 'daily' ? 'Last 14 Days' : 'Net Sales Trend'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-display), serif', fontSize: '28px', color: 'var(--navy)', lineHeight: 1 }}>
                    {tab === 'daily' ? fmt(last14.reduce((s, r) => s + r['netsales_$'], 0)) :
                     tab === 'weekly' ? fmt(weekNet) :
                     tab === 'monthly' ? fmt(monthNet) :
                     tab === 'ytd' ? fmt(ytdNet) :
                     fmt((cmpRowA?.['netsales_$'] ?? 0))}
                  </p>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-muted)' }}>{periodLabel}</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mainChartData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" {...axisProps} />
                  <YAxis tickFormatter={fmtK} {...axisProps} />
                  <Tooltip formatter={(v: number) => [fmt(v), 'Net Sales']} />
                  <Area type="monotone" dataKey="sales" stroke={C.blue} strokeWidth={2.5} fill="url(#salesGrad)" dot={false} name="Net Sales" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Orders / DOW chart */}
            <div style={{
              background: 'var(--bg-card-alt)', border: '1.5px solid var(--border-soft)',
              borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '22px',
            }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-label)', marginBottom: 4 }}>
                {tab === 'ytd' || tab === 'weekly' ? 'Avg by Day of Week' : 'Orders Trend'}
              </p>
              <p style={{ fontFamily: 'var(--font-display), serif', fontSize: '28px', color: 'var(--navy)', lineHeight: 1, marginBottom: 16 }}>
                {tab === 'daily' ? (dailyRow?.order_count.toLocaleString() ?? '—') :
                 tab === 'weekly' ? weekOrders.toLocaleString() :
                 tab === 'monthly' ? monthOrders.toLocaleString() :
                 tab === 'ytd' ? ytdOrders.toLocaleString() : '—'}
              </p>
              <ResponsiveContainer width="100%" height={183}>
                {(tab === 'ytd' || tab === 'weekly') ? (
                  <BarChart data={dowData}>
                    <CartesianGrid strokeDasharray="3 6" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="day" {...axisProps} />
                    <YAxis tickFormatter={fmtK} {...axisProps} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Avg Sales']} />
                    <Bar dataKey="avg" fill={C.sandLight} radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={mainChartData}>
                    <defs>
                      <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.sand} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.sand} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="date" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Orders']} />
                    <Area type="monotone" dataKey="orders" stroke={C.sand} strokeWidth={2} fill="url(#ordGrad)" dot={false} name="Orders" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── BOTTOM ROW ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>

            {/* Waste items table */}
            <div style={{
              background: 'var(--bg-card-alt)', border: '1.5px solid var(--border-soft)',
              borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '22px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>Top Waste Items</p>
                {wasteData && (
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 700,
                    background: wasteData.wastePct > 15 ? 'rgba(215,104,132,0.12)' : 'rgba(34,92,194,0.08)',
                    color: wasteData.wastePct > 15 ? '#B5405A' : 'var(--blue)',
                    padding: '4px 12px', borderRadius: 20,
                  }}>
                    {wasteData.wastePct.toFixed(1)}% waste rate
                  </span>
                )}
              </div>
              <WasteTable items={wasteData?.topItems ?? []} />
            </div>

            {/* Waste summary stats */}
            <div style={{
              background: 'var(--bg-card-alt)', border: '1.5px solid var(--border-soft)',
              borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '22px',
            }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--navy)', marginBottom: 18 }}>Waste Summary</p>
              {wasteData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { label: 'Waste Rate',    value: wasteData.wastePct.toFixed(1) + '%',   sub: 'of total inventory' },
                    { label: 'Units Wasted',  value: Math.round(wasteData.totalWasteQty).toLocaleString(), sub: 'total units' },
                    { label: 'Retail Value',  value: fmt(wasteData.totalWasteValue),         sub: 'at retail price' },
                    { label: 'COGS Impact',   value: fmt(wasteData.totalWasteCogs),          sub: 'cost of goods' },
                  ].map((item, i, arr) => (
                    <div key={item.label} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 0',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border-soft)' : 'none',
                    }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--text-label)', letterSpacing: '0.04em' }}>{item.label}</p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</p>
                      </div>
                      <p style={{ fontFamily: 'var(--font-display), serif', fontSize: '22px', color: 'var(--navy)' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-muted)', paddingTop: 20 }}>No waste data for this period.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
