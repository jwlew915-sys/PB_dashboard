const fs = require('fs'), path = require('path'), https = require('https')
const SB_HOST = 'iofqztuvehflpgaxjplt.supabase.co'
const SB_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZnF6dHV2ZWhmbHBnYXhqcGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIzNDMsImV4cCI6MjA4OTY1ODM0M30.Op9_PzpQV4OgCvVKCueGKp7DNCXRV7JYM_dqOf2wfLI'

function sbRequest(table, rows) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(rows)
    const r = https.request({ hostname: SB_HOST, path: '/rest/v1/' + table, method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Prefer': 'resolution=merge-duplicates,return=minimal' }
    }, (resp) => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>resolve({status:resp.statusCode,body:d})) })
    r.on('error', reject); r.write(body); r.end()
  })
}

function parseNum(s) {
  if (!s || s.trim()==='' || s.trim()==='-') return null
  return parseFloat(s.replace(/[$,%\s,]/g,'')) || null
}

function parseDate(s) {
  if (!s) return null; s = s.trim()
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) { let y=m[3]; if(y.length===2) y='20'+y; return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` }
  return null
}

async function main() {
  const file = process.argv[2]
  const dateArg = process.argv[3]
  if (!file) { console.error('Usage: node scripts/import-waste.js <csv-file> <YYYY-MM-DD>'); process.exit(1) }
  if (!dateArg) { console.error('Please provide a date: YYYY-MM-DD'); process.exit(1) }
  const business_date = parseDate(dateArg)
  if (!business_date) { console.error('Invalid date format. Use YYYY-MM-DD'); process.exit(1) }

  console.log(`Paris Baguette FR-1554 — Importing product mix for ${business_date}`)
  console.log('='.repeat(55))

  const text = fs.readFileSync(path.resolve(file), 'utf8')
  const lines = text.trim().split('\n')
  const delim = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].replace(/\r/,'').split(delim).map(h=>h.trim().replace(/"/g,'').toLowerCase())
  console.log(`Headers: ${headers.join(' | ')}`)

  // Detect format by checking if first column is "business date" or "item"
  const firstCol = headers[0]
  const hasBizDate = firstCol.includes('business') || firstCol.includes('date')
  console.log(`Format: ${hasBizDate ? 'Business Date + Item (Toast waste export)' : 'Item only (Toast items export)'}`)

  const rows = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/\r/,'').split(delim).map(c=>c.trim().replace(/^"|"$/g,''))
    
    let itemName, rowDate
    if (hasBizDate) {
      // Format: Business Date, Item, Qty Sold, Avg Price, Gross Sales, Discount, Refund, Net Sales, Tax, Void Amount, Waste Count, Waste Amount
      rowDate = parseDate(cols[0])
      itemName = cols[1]?.trim()
    } else {
      // Format: Item, Sales Category, Qty Sold, ...
      itemName = cols[0]?.trim()
      rowDate = business_date
    }

    if (!itemName || itemName === '') { skipped++; continue }
    if (!rowDate) { skipped++; continue }

    if (hasBizDate) {
      rows.push({
        business_date: rowDate,
        item_name: itemName,
        sales_category: null,
        qty_sold: parseNum(cols[2]),
        gross_sales: parseNum(cols[4]),
        discount_amount: parseNum(cols[5]),
        refund_amount: parseNum(cols[6]),
        net_sales: parseNum(cols[7]),
        tax: parseNum(cols[8]),
        voided_gross_sales: parseNum(cols[9]),
        waste_count: parseNum(cols[10]),
        waste_amount: parseNum(cols[11]),
      })
    } else {
      rows.push({
        business_date: rowDate,
        item_name: itemName,
        sales_category: cols[1] || null,
        qty_sold: parseNum(cols[2]),
        item_cogs: parseNum(cols[3]),
        gross_sales: parseNum(cols[4]),
        discount_amount: parseNum(cols[5]),
        refund_amount: parseNum(cols[6]),
        net_sales: parseNum(cols[7]),
        cogs: null,
        gross_profit: parseNum(cols[9]),
        gross_margin_pct: parseNum(cols[10]),
        tax: parseNum(cols[11]),
        waste_count: parseNum(cols[12]),
        waste_amount: parseNum(cols[13]),
        voided_gross_sales: parseNum(cols[14]),
        voided_qty_sold: parseNum(cols[15]),
        item_qty_incl_voids: parseNum(cols[16]),
        gross_amount_incl_voids: parseNum(cols[17]),
      })
    }
  }

  console.log(`Parsed ${rows.length} items (skipped ${skipped} rows)`)
  if (!rows.length) { console.error('No valid rows found!'); process.exit(1) }

  console.log('\nPreview (first 3):')
  rows.slice(0,3).forEach(r => console.log(`  ${r.item_name} | sold: ${r.qty_sold} | net: $${r.net_sales} | waste: ${r.waste_count} / $${r.waste_amount}`))

  const totalWaste = rows.reduce((s,r)=>s+(r.waste_amount||0),0)
  const totalNet = rows.reduce((s,r)=>s+(r.net_sales||0),0)
  console.log(`\nDay totals: Net $${totalNet.toFixed(2)} | Waste $${totalWaste.toFixed(2)} | Waste % ${totalNet?(totalWaste/totalNet*100).toFixed(2):'n/a'}%`)

  console.log('\nStep 1: Upserting into menu table...')
  const r1 = await sbRequest('menu', rows)
  if (r1.status !== 200 && r1.status !== 201) { console.error(`  Failed (${r1.status}): ${r1.body}`); process.exit(1) }
  console.log(`  Done! ${rows.length} items upserted`)

  console.log('\nStep 2: Updating daily_waste_% table...')
  const dates = [...new Set(rows.map(r=>r.business_date))]
  const wasteRows = dates.map(d => ({
    business_date: d,
    amount: Math.round(rows.filter(r=>r.business_date===d).reduce((s,r)=>s+(r.waste_amount||0),0)*100)/100
  }))
  const r2 = await sbRequest('daily_waste_%25', wasteRows)
  if (r2.status !== 200 && r2.status !== 201) { console.error(`  Failed (${r2.status}): ${r2.body}`); process.exit(1) }
  wasteRows.forEach(w => console.log(`  $${w.amount} waste recorded for ${w.business_date}`))
  console.log('\nAll done! Dashboard data updated.')
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1) })
