import { supabase, SalesRow } from './supabase'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, format, subYears } from 'date-fns'

function fmt(d: Date) { return format(d, 'yyyy-MM-dd') }

export async function fetchRange(from: string, to: string): Promise<SalesRow[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date', { ascending: true })
  if (error) throw error
  return data as SalesRow[]
}

export async function fetchDay(date: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('business_date', date)
    .single()
  if (error) return null
  return data as SalesRow
}

export async function fetchWeek(date: Date) {
  const from = fmt(startOfWeek(date, { weekStartsOn: 1 }))
  const to   = fmt(endOfWeek(date,   { weekStartsOn: 1 }))
  return fetchRange(from, to)
}

export async function fetchMonth(date: Date) {
  return fetchRange(fmt(startOfMonth(date)), fmt(endOfMonth(date)))
}

export async function fetchYTD(year: number) {
  const from = `${year}-01-01`
  const to   = `${year}-12-31`
  return fetchRange(from, to)
}

export function calcMetrics(rows: SalesRow[]) {
  const totalSales  = rows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const totalOrders = rows.reduce((s, r) => s + (r.order_count   || 0), 0)
  const avgDaily    = rows.length ? totalSales / rows.length : 0
  const avgOrder    = totalOrders ? totalSales / totalOrders : 0
  const bestDay     = rows.reduce((best, r) => r['netsales_$'] > (best?.['netsales_$'] ?? 0) ? r : best, rows[0])
  return { totalSales, totalOrders, avgDaily, avgOrder, bestDay, days: rows.length }
}

export function fmt$(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

export function fmtK(n: number) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k'
  return '$' + Math.round(n)
}
