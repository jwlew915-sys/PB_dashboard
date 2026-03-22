/**
 * Paris Baguette FR-1554 — Waste CSV Import
 * 
 * Usage: node scripts/import-waste.js path/to/waste-export.csv
 * 
 * Accepts Toast "Waste" export (tab-separated or comma-separated):
 * business_date, mi_master_id, mi_name, quantity, total_retail_value,
 * waste_reasons, quantity_sold, total_quantity, waste_percentage, total_item_cogs
 */

const fs   = require('fs')
const path = require('path')
const https = require('https')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iofqztuvehflpgaxjplt.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZnF6dHV2ZWhmbHBnYXhqcGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIzNDMsImV4cCI6MjA4OTY1ODM0M30.Op9_PzpQV4OgCvVKCueGKp7DNCXRV7JYM_dqOf2wfLI'

function request(path, body) {
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'iofqztuvehflpgaxjplt.supabase.co',
      path,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }
    }, (resp) => {
      let d = ''
      resp.on('data', c => d += c)
      resp.on('end', () => resolve({ status: resp.statusCode, body: d }))
    })
    r.on('error', reject)
    r.write(JSON.stringify(body))
    r.end()
  })
}

function parseDate(s) {
  // Handles "3/20/26", "3/20/2026", "2026-03-20"
  s = s.trim().replace(/"/g, '')
  if (s.includes('-')) return s
  const parts = s.split('/')
  if (parts.length === 3) {
    let [m, d, y] = parts
    if (y.length === 2) y = '20' + y
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return null
}

function parseNum(s) {
  if (!s || s.trim() === '') return null
  return parseFloat(s.replace(/[$,"\s]/g, '')) || null
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node scripts/import-waste.js <path-to-csv>')
    process.exit(1)
  }

  const text = fs.readFileSync(path.resolve(file), 'utf8')
  const lines = text.trim().split('\n')

  // Auto-detect delimiter (tab or comma)
  const delim = lines[0].includes('\t') ? '\t' : ','
  console.log(`Delimiter: ${delim === '\t' ? 'tab' : 'comma'}`)

  const headers = lines[0].replace(/\r/,'').split(delim).map(h => h.trim().toLowerCase().replace(/"/g,''))
  console.log(`Headers: ${headers.join(', ')}`)

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/\r/,'').split(delim).map(c => c.trim().replace(/^"|"$/g,''))
    if (cols.length < 3) continue

    const date = parseDate(cols[0])
    if (!date) { console.warn(`  Skipping row ${i+1}: bad date "${cols[0]}"`); continue }

    rows.push({
      business_date:      date,
      mi_master_id:       cols[1] || null,
      mi_name:            cols[2] || null,
      quantity:           parseNum(cols[3]),
      total_retail_value: parseNum(cols[4]),
      waste_reasons:      cols[5] || null,
      quantity_sold:      parseNum(cols[6]),
      total_quantity:     parseNum(cols[7]),
      waste_percentage:   parseNum(cols[8]),
      total_item_cogs:    parseNum(cols[9]),
    })
  }

  if (!rows.length) {
    console.error('No valid rows found. Check your file format.')
    process.exit(1)
  }

  // Show summary
  const dates = [...new Set(rows.map(r => r.business_date))].sort()
  console.log(`\nParsed ${rows.length} items across ${dates.length} date(s): ${dates.join(', ')}`)

  // Step 1: Upsert into menu table
  console.log('\nStep 1: Upserting into menu table...')
  const r1 = await request('/rest/v1/menu', rows)
  if (r1.status !== 200 && r1.status !== 201) {
    console.error(`  menu upsert failed (${r1.status}): ${r1.body}`)
    process.exit(1)
  }
  console.log(`  menu: ${rows.length} rows upserted`)

  // Step 2: Aggregate and upsert daily waste totals
  const dailyTotals = {}
  for (const r of rows) {
    if (!dailyTotals[r.business_date]) dailyTotals[r.business_date] = 0
    dailyTotals[r.business_date] += (r.total_retail_value || 0)
  }

  const wasteRows = Object.entries(dailyTotals).map(([date, amount]) => ({
    business_date: date,
    amount: Math.round(amount * 100) / 100
  }))

  console.log('\nStep 2: Upserting daily waste totals...')
  const r2 = await request('/rest/v1/daily_waste_%25', wasteRows)
  if (r2.status !== 200 && r2.status !== 201) {
    console.error(`  daily_waste_% upsert failed (${r2.status}): ${r2.body}`)
    process.exit(1)
  }

  console.log('\nDaily waste totals:')
  for (const [date, amount] of Object.entries(dailyTotals)) {
    console.log(`  ${date}: $${amount.toFixed(2)} total waste`)
  }

  console.log('\nDone! Your dashboard waste data is updated.')
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1) })
