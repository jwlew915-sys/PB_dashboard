import { supabase, SalesRow } from './supabase'

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

export function getWeekRange(dateStr: string): [string, string] {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)]
}

export function getMonthRange(monthStr: string): [string, string] {
  const [y, m] = monthStr.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2,'0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
  return [from, to]
}

export function getPriorYearDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

export function calcMetrics(rows: SalesRow[]) {
  const totalSales  = rows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const totalOrders = rows.reduce((s, r) => s + (r.order_count   || 0), 0)
  const avgDaily    = rows.length ? to
cd ~/Desktop/pb-dashboard
cat > src/lib/data.ts << 'EOF'
import { supabase, SalesRow } from './supabase'

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

export function getWeekRange(dateStr: string): [string, string] {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)]
}

export function getMonthRange(monthStr: string): [string, string] {
  const [y, m] = monthStr.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2,'0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
  return [from, to]
}

export function getPriorYearDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
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

