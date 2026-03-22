/**
 * Paris Baguette FR-1554 — Product Mix & Waste CSV Import
 * 
 * Usage: node scripts/import-waste.js path/to/export.csv 2026-03-20
 * 
 * Accepts Toast "Item Sales" export (tab-separated):
 * Item, Sales Category, Qty sold, Item COGS, Gross sales, Discount amount,
 * Refund amount, Net sales, COGS, Gross profit, Gross margin (%), Tax,
 * Waste count, Waste amount, Voided gross sale, Voided qty sold,
 * Item qty incl. voids, Gross amount incl. voids
 * 
 * NOTE: Rows without an Item name in column A are skipped (summary rows)
 */

const fs    = require('fs')
const path  = require('path')
const https = require('https')

const SB_HOST = 'iofqztuvehflpgaxjplt.supabase.co'
const SB_KEY  = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZnF6dHV2ZWhmbHBnYXhqcGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIzNDMsImV4cCI6MjA4OTY1ODM0M30.Op9_PzpQV4OgCvVKCueGKp7DNCXRV7JYM_dqOf2wfLI'

function sbRequest(table, rows) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(rows)
    const r = https.request({
      hostname: SB_HOST,
      path: '/rest/v1/' + table,
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }
    }, (resp) => {
      let d = ''
      resp.on('data', c => d += c)
      resp.on('end', () => resolve({ status: resp.statusCode, body: d }))
    })
    r.on('error', reject)
    r.write(body)
    r.end()
  })
}

function parseNum(s) {
  if (!s || s.trim() === '' || s.trim() === '-') return null
  return parseFloat(s.replace(/[$,%\s,]/g, '')) || null
}

function parseDate(s) {
  if (!s) return null
  s = s.trim()
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s
  // Handle M/D/YY or M/D/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    let y = m[3]; if (y.length === 2) y = '20' + y
    return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
  }
  return null
}

async function main() {
  const file    = process.argv[2]
  const dateArg = process.argv[3]

  if (!file) {
    console.error('Usage: node scripts/import-waste.js <csv-file> <YYYY-MM-DD>')
    console.error('Example: node scripts/import-waste.js ~/Downloads/items.csv 2026-03-21')
    process.exit(1)
  }
  if (!dateArg || !parseDate(dateArg)) {
    console.error('Please provide a valid date as second argument: YYYY-MM-DD')
    console.error('Example: node scripts/import-waste.js ~/Downloads/items.csv 2026-03-21')
    process.exit(1)
  }

  const business_date = parseDate(dateArg)
  console.log(`Paris Baguette FR-1554 — Importing product mix for ${business_date}`)
  console.log('='.repeat(55))

  const text  = fs.readFileSync(path.resolve(file), 'utf8')
  const lines = text.trim().split('\n')

  // Auto-detect delimiter
  const delim = lines[0].includes('\t') ? '\t' : ','
  console.log(`Delimiter: ${delim === '\t' ? 'tab' : 'comma'}`)

  // Parse header row
  const headers = lines[0].replace(/\r/,'').split(delim).map(h => h.trim().replace(/"/g,'').toLowerCase())
  
  // Find column indices
  const col = (name) => headers.findIndex(h => h.includes(name.toLowerCase()))
  const idx = {
    item:                 0,
    sales_category:       col('sales category'),
    qty_sold:             col('qty sold'),
    item_cogs:            col('item cogs'),
    gross_sales:          col('gross sales'),
    discount_amount:      col('discount'),
    refund_amount:        col('refund'),
    net_sales:            col('net sales'),
    cogs:                 col('cogs') > col('item cogs') ? col('cogs') : -1,
    gross_profit:         col('gross profit'),
    gross_margin_pct:     col('gross margin'),
    tax:                  col('tax'),
    waste_count:          col('waste count'),
    waste_amount:         col('waste amount'),
    voided_gross_sales:   col('voided gross'),
    voided_qty_sold:      col('voided qty'),
    item_qty_incl_voids:  col('item qty'),
    gross_amount_incl_voids: col('gross amount incl'),
  }

  const rows = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/\r/,'').split(delim).map(c => c.trim().replace(/^"|"$/g,''))
    const itemName = cols[0]?.trim()

    // Skip rows without an item name (summary/total rows)
    if (!itemName || itemName === '') { skipped++; continue }

    rows.push({
      business_date,
      item_name:               itemName,
      sales_category:          cols[idx.sales_category]              || null,
      qty_sold:                parseNum(cols[idx.qty_sold]),
      item_cogs:               parseNum(cols[idx.item_cogs]),
      gross_sales:             parseNum(cols[idx.gross_sales]),
      discount_amount:         parseNum(cols[idx.discount_amount]),
      refund_amount:           parseNum(cols[idx.refund_amount]),
      net_sales:               parseNum(cols[idx.net_sales]),
      cogs:                    idx.cogs > 0 ? parseNum(cols[idx.cogs]) : null,
      gross_profit:            parseNum(cols[idx.gross_profit]),
      gross_margin_pct:        parseNum(cols[idx.gross_margin_pct]),
      tax:                     parseNum(cols[idx.tax]),
      waste_count:             parseNum(cols[idx.waste_count]),
      waste_amount:            parseNum(cols[idx.waste_amount]),
      voided_gross_sales:      parseNum(cols[idx.voided_gross_sales]),
      voided_qty_sold:         parseNum(cols[idx.voided_qty_sold]),
      item_qty_incl_voids:     parseNum(cols[idx.item_qty_incl_voids]),
      gross_amount_incl_voids: parseNum(cols[idx.gross_amount_incl_voids]),
    })
  }

  console.log(`Parsed ${rows.length} items (skipped ${skipped} summary rows)`)

  // Show preview
  console.log('\nPreview (first 3 items):')
  rows.slice(0,3).forEach(r => {
    console.log(`  ${r.item_name} | sold: ${r.qty_sold} | net: $${r.net_sales} | waste: ${r.waste_count} units / $${r.waste_amount}`)
  })

  // Total waste for the day
  const totalWaste = rows.reduce((s,r) => s + (r.waste_amount||0), 0)
  const totalNet   = rows.reduce((s,r) => s + (r.net_sales||0), 0)
  const wastePct   = totalNet ? (totalWaste/totalNet*100).toFixed(2) : 'n/a'
  console.log(`\nDay totals: Net sales $${totalNet.toFixed(2)} | Waste $${totalWaste.toFixed(2)} | Waste % ${wastePct}%`)

  // Step 1: Upsert into menu table
  console.log('\nStep 1: Upserting into menu table...')
  const r1 = await sbRequest('menu', rows)
  if (r1.status !== 200 && r1.status !== 201) {
    console.error(`  Failed (${r1.status}): ${r1.body}`)
    process.exit(1)
  }
  console.log(`  Done! ${rows.length} items upserted`)

  // Step 2: Upsert daily waste total
  console.log('\nStep 2: Updating daily_waste_% table...')
  const wasteRow = [{ business_date, amount: Math.round(totalWaste * 100) / 100 }]
  const r2 = await sbRequest('daily_waste_%25', wasteRow)
  if (r2.status !== 200 && r2.status !== 201) {
    console.error(`  Failed (${r2.status}): ${r2.body}`)
    process.exit(1)
  }
  console.log(`  Done! $${totalWaste.toFixed(2)} waste recorded for ${business_date}`)

  console.log('\nAll done! Dashboard data updated.')
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1) })
