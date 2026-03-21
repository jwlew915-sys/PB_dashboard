# Paris Baguette FR-1554 — Business Dashboard

A Next.js dashboard connected to Supabase showing daily, weekly, monthly, YTD, and year-over-year sales data.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Already configured in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Data

The `sales` table in Supabase contains:
- `business_date` (date)
- `netsales_$` (numeric)
- `order_count` (integer)
- `avg_order` (numeric)

To add more data, import your Toast CSV exports into the `sales` table via Supabase Table Editor.

## Tabs

| Tab | What it shows |
|-----|---------------|
| Daily | Single-day metrics — pick any date |
| Weekly | Mon–Sun week totals + bar chart |
| Monthly | Full month trend line with orders overlay |
| YTD | Monthly bar chart + day-of-week averages |
| YoY Compare | Any date vs same date prior year with % change |
