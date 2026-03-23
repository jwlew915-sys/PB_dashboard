import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type SalesRow = {
  id: number
  business_date: string
  'netsales_$': number
  order_count: number
  avg_order: number | null
}

export type HourlyRow = {
  id: number
  business_date: string
  hour: number
  net_sales: number
  order_count: number
}

export type MenuRow = {
  id: number
  business_date: string
  item_name: string
  sales_category: string | null
  qty_sold: number | null
  item_cogs: number | null
  gross_sales: number | null
  discount_amount: number | null
  refund_amount: number | null
  net_sales: number | null
  cogs: number | null
  gross_profit: number | null
  gross_margin_pct: number | null
  tax: number | null
  waste_count: number | null
  waste_amount: number | null
  voided_gross_sales: number | null
  voided_qty_sold: number | null
  item_qty_incl_voids: number | null
  gross_amount_incl_voids: number | null
}
