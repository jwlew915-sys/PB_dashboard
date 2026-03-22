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

export type MenuRow = {
  id: number
  business_date: string
  mi_master_id: string
  mi_name: string
  quantity: number
  total_retail_value: number
  waste_reasons: string | null
  quantity_sold: number
  total_quantity: number
  waste_percentage: number
  total_item_cogs: number
}
