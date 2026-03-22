import { supabase, SalesRow, MenuRow } from './supabase'

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
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return [from, to]
}

export function getPriorYearDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

export function calcMetrics(rows: SalesRow[]) {
  const totalSales = rows.reduce((s, r) => s + (r['netsales_$'] || 0), 0)
  const totalOrders = rows.reduce((s, r) => s + (r.order_count || 0), 0)
  const avgDaily = rows.length ? totalSales / rows.length : 0
  const avgOrder = totalOrders ? totalSales / totalOrders : 0
  const bestDay = rows.reduce((best, r) => r['netsales_$'] > (best?.['netsales_$'] ?? 0) ? r : best, rows[0])
  return { totalSales, totalOrders, avgDaily, avgOrder, bestDay, days: rows.length }
}

export function fmt$(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

/**
 * Collapses multiple rows for the same business_date into one aggregated row.
 * Necessary because the sales table may have multiple entries per day.
 */
export function groupSalesByDate(rows: SalesRow[]): SalesRow[] {
  const map: Record<string, { net: number; orders: number; id: number }> = {}
  rows.forEach(r => {
    // Normalize to YYYY-MM-DD regardless of whether Supabase returns a date
    // string, timestamp, or ISO string with timezone
    const date = String(r.business_date).slice(0, 10)
    if (!map[date]) map[date] = { net: 0, orders: 0, id: r.id }
    map[date].net    += r['netsales_$'] || 0
    map[date].orders += r.order_count   || 0
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => ({
      id:             agg.id,
      business_date:  date,
      'netsales_$':   agg.net,
      order_count:    agg.orders,
      avg_order:      agg.orders > 0 ? agg.net / agg.orders : null,
    }))
}

export async function fetchWasteRange(from: string, to: string): Promise<MenuRow[]> {
  const { data, error } = await supabase
    .from('menu')
    .select('*')
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date', { ascending: true })
  if (error) throw error
  return data as MenuRow[]
}

export function calcWaste(rows: MenuRow[], netSales: number) {
  const totalWasteQty   = rows.reduce((s, r) => s + (r.quantity || 0), 0)
  const totalWasteValue = rows.reduce((s, r) => s + (r.total_retail_value || 0), 0)
  const totalWasteCogs  = rows.reduce((s, r) => s + (r.total_item_cogs || 0), 0)
  // Waste % = total waste retail value / net sales
  const wastePct        = netSales > 0 ? (totalWasteValue / netSales) * 100 : 0

  // Aggregate by item name across multiple dates
  const byItem: Record<string, { name: string; qty: number; value: number; cogs: number; totalQty: number }> = {}
  rows.forEach(r => {
    const key = r.mi_master_id
    if (!byItem[key]) byItem[key] = { name: r.mi_name, qty: 0, value: 0, cogs: 0, totalQty: 0 }
    byItem[key].qty      += r.quantity || 0
    byItem[key].value    += r.total_retail_value || 0
    byItem[key].cogs     += r.total_item_cogs || 0
    byItem[key].totalQty += r.total_quantity || 0
  })

  const topItems = Object.values(byItem)
    .map(item => ({
      name:    item.name,
      qty:     item.qty,
      value:   item.value,
      cogs:    item.cogs,
      pct:     item.totalQty > 0 ? (item.qty / item.totalQty) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return { wastePct, totalWasteQty, totalWasteValue, totalWasteCogs, topItems }
}
