'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, SalesRow, MenuRow } from '@/lib/supabase'
import { calcWaste } from '@/lib/data'
import MetricCard from '@/components/MetricCard'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

type Tab = 'daily' | 'weekly' | 'monthly' | 'ytd' | 'compare'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const fmtK = (n: number) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n)

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

const C = {
  blue:      '#225CC2',
  blueMid:   '#3B74D9',
  navy:      '#17294C',
  sand:      '#D0B283',
  sandLight: '#E8D4B0',
  rosy:      '#D76884',
  rosyLight: '#F2B8C6',
  grid:      'rgba(208,178,131,0.2)',
  tick:      '#9A8A98',
}

const axisProps = {
  tick: { fontSize: 11, fill: C.tick, fontFamily: 'var(--font-body)' },
  axisLine: false as const,
  tickLine: false as const,
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-body), sans-serif',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-label)',
  marginBottom: '14px',
}

const card: React.CSSProperties = {
  background: 'var(--bg-card-alt)',
  border: '1.5px solid var(--border-soft)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-card)',
  padding: '24px',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-card-alt)',
  border: '1.5px solid var(--border)',
  borderRadius: 10,
  color: 'var(--navy)',
  fontFamily: 'var(--font-body), sans-serif',
  fontSize: '13px',
  fontWeight: 500,
  padding: '8px 14px',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body), sans-serif',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-label)',
}

// ── Waste table component ─────────────────────────────────────────────────────
type WasteItem = { name: string; qty: number; value: number; cogs: number; pct: number }

function WasteTable({ items }: { items: WasteItem[] }) {
  if (!items.length) return null
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr>
          {['Item', 'Waste Qty', 'Waste %', 'Retail Value', 'COGS'].map(h => (
            <th key={h} style={{
              fontFamily: 'var(--font-body), sans-serif',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-label)',
              textAlign: h === 'Item' ? 'left' : 'right',
              paddingBottom: 10,
              borderBottom: '1.5px solid var(--border-soft)',
            }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
            <td style={{
              fontFamily: 'var(--font-body), sans-serif',
              fontWeight: 500,
              color: 'var(--navy)',
              padding: '10px 0',
              maxWidth: 260,
            }}>
              {item.name}
            </td>
            <td style={{ textAlign: 'right', padding: '10px 0', color: 'var(--text-body)', fontWeight: 500 }}>
              {item.qty.toFixed(1)}
            </td>
            <td style={{ textAlign: 'right', padding: '10px 0' }}>
              <span style={{
                background: item.pct > 20 ? 'rgba(215,104,132,0.12)' : 'rgba(208,178,131,0.18)',
                color: item.pct > 20 ? '#B5405A' : '#7A5C30',
                borderRadius: 6,
                padding: '2px 8px',
                fontWeight: 700,
                fontSize: '12px',
              }}>
                {item.pct.toFixed(1)}%
              </span>
            </td>
            <td style={{ textAlign: 'right', padding: '10px 0', color: 'var(--text-body)', fontWeight: 500 }}>
              {fmt(item.value)}
            </td>
            <td style={{ textAlign: 'right', padding: '10px 0', color: 'var(--text-body)', fontWeight: 500 }}>
              {fmt(item.cogs)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Waste section (metric cards + table) ──────────────────────────────────────
function WasteSection({ menuRows }: { menuRows: MenuRow[] }) {
  const waste = useMemo(() => calcWaste(menuRows), [menuRows])

  if (!menuRows.length) return null

  return (
    <div style={{ marginTop: 20 }}>
      {/* Divider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
      }}>
        <div style={{ height: 1, flex: 1, background: 'var(--border-soft)' }} />
        <span style={{
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          Waste
        </span>
        <div style={{ height: 1, flex: 1, background: 'var(--border-soft)' }} />
      </div>

      {/* Waste metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <MetricCard
          label="Waste %"
          value={waste.wastePct.toFixed(1) + '%'}
          badge={waste.wastePct > 15 ? 'High' : 'OK'}
          badgeColor={waste.wastePct > 15 ? 'rosy' : 'sand'}
          large
        />
        <MetricCard label="Waste Qty" value={waste.totalWasteQty.toFixed(0)} />
        <MetricCard label="Waste Value" value={fmt(waste.totalWasteValue)} />
        <MetricCard label="Waste COGS" value={fmt(waste.totalWasteCogs)} />
      </div>

      {/* Top waste items table */}
      {waste.topItems.length > 0 && (
        <div style={card}>
          <p style={sectionLabel}>Top waste items by quantity</p>
          <WasteTable items={waste.topItems} />
        </div>
      )}
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('daily')
  const [allData, setAllData]   = useState<SalesRow[]>([])
  const [allMenu, setAllMenu]   = useState<MenuRow[]>([])
  const [loading, setLoading]   = useState(true)

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
      setAllData((salesRes.data as SalesRow[]) || [])
      setAllMenu((menuRes.data as MenuRow[])   || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── DAILY ──
  const dailyRow      = useMemo(() => allData.find(r => r.business_date === dailyDate), [allData, dailyDate])
  const dailyMenuRows = useMemo(() => allMenu.filter(r => r.business_date === dailyDate), [allMenu, dailyDate])

  // ── WEEKLY ──
  const weekFrom    = startOfWeek(new Date(weekDate + 'T00:00:00'))
  const weekTo      = endOfWeek(new Date(weekDate + 'T00:00:00'))
  const weekRows    = useMemo(() => allData.filter(r => r.business_date >= weekFrom && r.business_date <= weekTo), [allData, weekFrom, weekTo])
  const weekMenuRows = useMemo(() => allMenu.filter(r => r.business_date >= weekFrom && r.business_date <= weekTo), [allMenu, weekFrom, weekTo])
  const weekNet     = weekRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const weekOrders  = weekRows.reduce((s, r) => s + (r.order_count   || 0), 0)

  // ── MONTHLY ──
  const monthRows     = useMemo(() => allData.filter(r => r.business_date.startsWith(month)), [allData, month])
  const monthMenuRows = useMemo(() => allMenu.filter(r => r.business_date.startsWith(month)), [allMenu, month])
  const monthNet      = monthRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const monthOrders   = monthRows.reduce((s, r) => s + (r.order_count   || 0), 0)
  const monthAvgDaily = monthRows.length ? monthNet / monthRows.length : 0

  // ── YTD ──
  const ytdRows     = useMemo(() => allData.filter(r => r.business_date.startsWith(year)), [allData, year])
  const ytdMenuRows = useMemo(() => allMenu.filter(r => r.business_date.startsWith(year)), [allMenu, year])
  const ytdNet      = ytdRows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const ytdOrders   = ytdRows.reduce((s, r) => s + (r.order_count   || 0), 0)

  const ytdByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    ytdRows.forEach(r => {
      const mo = r.business_date.slice(0, 7)
      map[mo] = (map[mo] || 0) + (r['netsales_$'] || 0)
    })
    return Object.entries(map).sort().map(([mo, net]) => ({ month: mo.slice(5), net: Math.round(net) }))
  }, [ytdRows])

  // ── YoY ──
  const [cmpY, cmpM, cmpD] = cmpDate.split('-')
  const prevDate = `${parseInt(cmpY) - 1}-${cmpM}-${cmpD}`
  const cmpRowA  = useMemo(() => allData.find(r => r.business_date === cmpDate),  [allData, cmpDate])
  const cmpRowB  = useMemo(() => allData.find(r => r.business_date === prevDate), [allData, prevDate])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'daily',   label: 'Daily'   },
    { id: 'weekly',  label: 'Weekly'  },
    { id: 'monthly', label: 'Monthly' },
    { id: 'ytd',     label: 'YTD'     },
    { id: 'compare', label: 'YoY'     },
  ]

  const tabBtn = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--font-body), sans-serif',
    fontSize: '13px',
    fontWeight: active ? 700 : 500,
    padding: '8px 18px',
    borderRadius: 24,
    border: 'none',
    background: active ? 'var(--navy)' : 'transparent',
    color: active ? '#fff' : 'var(--text-label)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.01em',
  })

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--cream)',
        flexDirection: 'column',
        gap: 18,
      }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: 36,
          height: 36,
          border: '2.5px solid var(--sand-light)',
          borderTopColor: 'var(--blue)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          Loading dashboard
        </p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* ─── HEADER ─── */}
      <header style={{
        background: 'var(--navy)',
        padding: '0 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 66,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--rosy)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-display), serif', fontSize: '16px', color: '#fff', fontStyle: 'italic', lineHeight: 1 }}>
              PB
            </span>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em', lineHeight: 1.2 }}>
              Paris Baguette
            </p>
            <p style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>
              FR-1554 · Edison, NJ · 1739 NJ-27
            </p>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
          {allData.length} days tracked
        </div>
      </header>

      {/* ─── TAB NAV ─── */}
      <div style={{
        background: 'var(--cream-deep)',
        borderBottom: '1.5px solid var(--border-soft)',
        padding: '10px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '36px 24px' }}>

        {/* ── DAILY ── */}
        {tab === 'daily' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <label style={labelStyle}>Date</label>
              <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <MetricCard label="Net Sales"   value={dailyRow ? fmt(dailyRow['netsales_$']) : '—'} badge={dailyRow ? 'Today' : undefined} badgeColor="rosy" large />
              <MetricCard label="Order Count" value={dailyRow ? dailyRow.order_count.toLocaleString() : '—'} />
              <MetricCard label="Avg Order"   value={dailyRow?.avg_order ? fmt(dailyRow.avg_order) : '—'} />
              <MetricCard label="Date"        value={dailyDate.slice(5).replace('-', '/')} />
            </div>
            {!dailyRow && (
              <div style={{
                marginTop: 20,
                background: 'rgba(208,178,131,0.15)',
                border: '1.5px solid var(--sand-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 18px',
                fontFamily: 'var(--font-body), sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-body)',
              }}>
                No sales record for {dailyDate} — try a different date.
              </div>
            )}
            <WasteSection menuRows={dailyMenuRows} />
          </div>
        )}

        {/* ── WEEKLY ── */}
        {tab === 'weekly' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <label style={labelStyle}>Week containing</label>
              <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} style={inputStyle} />
              <span style={{
                fontFamily: 'var(--font-body), sans-serif',
                fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)',
                background: 'rgba(208,178,131,0.18)', padding: '6px 12px', borderRadius: 8,
              }}>
                {weekFrom.slice(5)} → {weekTo.slice(5)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <MetricCard label="Net Sales"    value={fmt(weekNet)} large />
              <MetricCard label="Total Orders" value={weekOrders.toLocaleString()} />
              <MetricCard label="Avg Daily"    value={weekRows.length ? fmt(weekNet / weekRows.length) : '—'} />
              <MetricCard label="Days"         value={weekRows.length.toString()} />
            </div>
            {weekRows.length > 0 && (
              <div style={card}>
                <p style={sectionLabel}>Daily net sales — this week</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={weekRows.map(r => ({ date: r.business_date.slice(5), sales: r['netsales_$'] }))}>
                    <CartesianGrid strokeDasharray="3 6" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="date" {...axisProps} />
                    <YAxis tickFormatter={fmtK} {...axisProps} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Net Sales']} />
                    <Bar dataKey="sales" fill={C.blue} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <WasteSection menuRows={weekMenuRows} />
          </div>
        )}

        {/* ── MONTHLY ── */}
        {tab === 'monthly' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <label style={labelStyle}>Month</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <MetricCard label="Net Sales"    value={fmt(monthNet)} large />
              <MetricCard label="Total Orders" value={monthOrders.toLocaleString()} />
              <MetricCard label="Avg Daily"    value={fmt(monthAvgDaily)} />
              <MetricCard label="Days"         value={monthRows.length.toString()} />
            </div>
            {monthRows.length > 0 && (
              <div style={card}>
                <p style={sectionLabel}>Daily performance — {month}</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={monthRows.map(r => ({ date: r.business_date.slice(8), sales: r['netsales_$'], orders: r.order_count }))}>
                    <CartesianGrid strokeDasharray="3 6" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="date" {...axisProps} />
                    <YAxis yAxisId="left"  tickFormatter={fmtK} {...axisProps} />
                    <YAxis yAxisId="right" orientation="right" {...axisProps} />
                    <Tooltip formatter={(v: number, name: string) => [name === 'sales' ? fmt(v) : v.toLocaleString(), name === 'sales' ? 'Net Sales' : 'Orders']} />
                    <Legend />
                    <Line yAxisId="left"  type="monotone" dataKey="sales"  stroke={C.blue} strokeWidth={2.5} dot={false} name="sales"  />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke={C.sand} strokeWidth={1.5} dot={false} name="orders" strokeDasharray="4 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <WasteSection menuRows={monthMenuRows} />
          </div>
        )}

        {/* ── YTD ── */}
        {tab === 'ytd' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <label style={labelStyle}>Year</label>
              <input type="number" value={year} onChange={e => setYear(e.target.value)} min="2020" max="2030" style={{ ...inputStyle, width: 88 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <MetricCard label="YTD Net Sales" value={fmt(ytdNet)} large />
              <MetricCard label="YTD Orders"    value={ytdOrders.toLocaleString()} />
              <MetricCard label="Avg Daily"     value={ytdRows.length ? fmt(ytdNet / ytdRows.length) : '—'} />
              <MetricCard label="Days Tracked"  value={ytdRows.length.toString()} />
            </div>
            {ytdByMonth.length > 0 && (
              <div style={{ ...card, marginBottom: 16 }}>
                <p style={sectionLabel}>Monthly net sales — {year}</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ytdByMonth}>
                    <CartesianGrid strokeDasharray="3 6" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="month" {...axisProps} />
                    <YAxis tickFormatter={fmtK} {...axisProps} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Net Sales']} />
                    <Bar dataKey="net" fill={C.blue} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {ytdRows.length > 0 && (() => {
              const dowMap: Record<string, { total: number; count: number }> = {}
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              ytdRows.forEach(r => {
                const dow = dayNames[new Date(r.business_date + 'T00:00:00').getDay()]
                if (!dowMap[dow]) dowMap[dow] = { total: 0, count: 0 }
                dowMap[dow].total += r['netsales_$'] || 0
                dowMap[dow].count++
              })
              const dowData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => ({
                day: d,
                avg: dowMap[d] ? Math.round(dowMap[d].total / dowMap[d].count) : 0,
              }))
              return (
                <div style={card}>
                  <p style={sectionLabel}>Average sales by day of week</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dowData}>
                      <CartesianGrid strokeDasharray="3 6" stroke={C.grid} vertical={false} />
                      <XAxis dataKey="day" {...axisProps} />
                      <YAxis tickFormatter={fmtK} {...axisProps} />
                      <Tooltip formatter={(v: number) => [fmt(v), 'Avg Sales']} />
                      <Bar dataKey="avg" fill={C.blueMid} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}
            <WasteSection menuRows={ytdMenuRows} />
          </div>
        )}

        {/* ── YoY COMPARE ── */}
        {tab === 'compare' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <label style={labelStyle}>Compare date</label>
              <input type="date" value={cmpDate} onChange={e => setCmpDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ ...card, borderColor: 'rgba(34,92,194,0.25)', borderWidth: 2 }}>
                <p style={{ ...sectionLabel, color: 'var(--blue)' }}>{cmpDate}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <MetricCard label="Net Sales" value={cmpRowA ? fmt(cmpRowA['netsales_$']) : '—'} badge="This Year" badgeColor="blue" />
                  <MetricCard label="Orders"    value={cmpRowA ? cmpRowA.order_count.toLocaleString() : '—'} />
                  <MetricCard label="Avg Order" value={cmpRowA?.avg_order ? fmt(cmpRowA.avg_order) : '—'} />
                  <MetricCard label="Year"      value={cmpY} />
                </div>
              </div>
              <div style={card}>
                <p style={sectionLabel}>{prevDate} · prior year</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <MetricCard label="Net Sales" value={cmpRowB ? fmt(cmpRowB['netsales_$']) : '—'} />
                  <MetricCard label="Orders"    value={cmpRowB ? cmpRowB.order_count.toLocaleString() : '—'} />
                  <MetricCard label="Avg Order" value={cmpRowB?.avg_order ? fmt(cmpRowB.avg_order) : '—'} />
                  <MetricCard label="Year"      value={(parseInt(cmpY) - 1).toString()} />
                </div>
              </div>
            </div>
            {(cmpRowA || cmpRowB) && (
              <div style={{ ...card, marginBottom: 16 }}>
                <p style={sectionLabel}>Sales & orders comparison</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[
                    { label: 'Net Sales', thisYear: cmpRowA?.['netsales_$'] || 0, priorYear: cmpRowB?.['netsales_$'] || 0 },
                    { label: 'Orders',    thisYear: cmpRowA?.order_count     || 0, priorYear: cmpRowB?.order_count     || 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 6" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="thisYear"  name={cmpDate}  fill={C.blue}      radius={[6, 6, 0, 0]} />
                    <Bar dataKey="priorYear" name={prevDate} fill={C.sandLight} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {cmpRowA && cmpRowB && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Net Sales', a: cmpRowA['netsales_$'], b: cmpRowB['netsales_$'], isCurrency: true },
                  { label: 'Orders',    a: cmpRowA.order_count,   b: cmpRowB.order_count,   isCurrency: false },
                ].map(({ label, a, b, isCurrency }) => {
                  const pct = b ? ((a - b) / b * 100) : 0
                  const up  = pct >= 0
                  return (
                    <div key={label} style={{ ...card, borderColor: up ? 'rgba(46,125,82,0.2)' : 'rgba(192,57,43,0.2)', borderWidth: 2 }}>
                      <p style={sectionLabel}>{label} year-over-year</p>
                      <p style={{ fontFamily: 'var(--font-display), serif', fontSize: '52px', lineHeight: 1, color: up ? '#2E7D52' : '#C0392B', letterSpacing: '-0.01em' }}>
                        {up ? '+' : ''}{pct.toFixed(1)}%
                      </p>
                      <p style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginTop: 10 }}>
                        {isCurrency ? fmt(a - b) : (a - b > 0 ? '+' : '') + (a - b).toLocaleString()}{' '}vs prior year
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
