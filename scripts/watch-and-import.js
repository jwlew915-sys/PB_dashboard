/**
 * Paris Baguette FR-1554 — Toast CSV Auto-Importer
 * 
 * Watches ~/Downloads/Toast Waste Reports/inbox/ for new CSV files.
 * When a file is dropped in, it auto-imports into Supabase and moves
 * the file to ~/Downloads/Toast Waste Reports/processed/
 * 
 * Setup:
 *   1. Run once to start: node scripts/watch-and-import.js
 *   2. Or run as a background service (see README)
 * 
 * File naming: include the date in the filename
 *   items_2026-03-21.csv  ← date extracted automatically
 *   2026-03-21-Items.csv  ← also works
 */

const fs      = require('fs')
const path    = require('path')
const https   = require('https')
const os      = require('os')

const INBOX_DIR     = path.join(os.homedir(), 'Downloads', 'Toast Waste Reports', 'inbox')
const PROCESSED_DIR = path.join(os.homedir(), 'Downloads', 'Toast Waste Reports', 'processed')
const SB_HOST       = 'iofqztuvehflpgaxjplt.supabase.co'
const SB_KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZnF6dHV2ZWhmbHBnYXhqcGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIzNDMsImV4cCI6MjA4OTY1ODM0M30.Op9_PzpQV4OgCvVKCueGKp7DNCXRV7JYM_dqOf2wfLI'

// ── Ensure folders exist ──────────────────────────────────────────────────────
function ensureDirs() {
  [INBOX_DIR, PROCESSED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`Created: ${dir}`)
    }
  })
}

// ── Extract date from filename ────────────────────────────────────────────────
function extractDate(filename) {
  // Try YYYY-MM-DD pattern anywhere in filename
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  // Try M/D/YY or MM/DD/YYYY
  const m2 = filename.match(/(\d{1,2})[_-](\d{1,2})[_-](\d{2,4})/)
  if (m2) {
    let y = m2[3]; if (y.length === 2) y = '20' + y
    return `${y}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`
  }
  return null
}

// ── Supabase upsert ───────────────────────────────────────────────────────────
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
      let d = ''; resp.on('data', c => d += c)
      resp.on('end', () => resolve({ status: resp.statusCode, body: d }))
    })
    r.on('error', reject); r.write(body); r.end()
  })
}

// ── Parse CSV ─────────────────────────────────────────────────────────────────
function parseCSV(filePath, business_date) {
  const text    = fs.readFileSync(filePath, 'utf8')
  const lines   = text.trim().split('\n')
  const delim   = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].replace(/\r/,'').split(delim).map(h => h.trim().replace(/"/g,'').toLowerCase())
  const firstCol = headers[0]
  const hasBizDate = firstCol.includes('business') || firstCol.includes('date')

  const parseNum = s => {
    if (!s || s.trim()==='' || s.trim()==='-') return null
    return parseFloat(s.replace(/[$,%\s,]/g,'')) || null
  }

  const rows = []
  let skipped = 0
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/\r/,'').split(delim).map(c => c.trim().replace(/^"|"$/g,''))
    let itemName, rowDate

    if (hasBizDate) {
      const raw = cols[0]?.trim()
      if (!raw) { skipped++; continue }
      // Parse date from first column
      const dm = raw.match(/^(\d{4}-\d{2}-\d{2})/) || raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
      if (dm) {
        rowDate = raw.match(/^\d{4}/) ? raw.slice(0,10) : (() => {
          const p = raw.split('/'); let y = p[2]; if(y.length===2) y='20'+y
          return `${y}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`
        })()
      } else { skipped++; continue }
      itemName = cols[1]?.trim()
    } else {
      itemName = cols[0]?.trim()
      rowDate  = business_date
    }

    if (!itemName || itemName === '') { skipped++; continue }

    if (hasBizDate) {
      rows.push({
        business_date: rowDate, item_name: itemName,
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
        business_date: rowDate, item_name: itemName,
        sales_category: cols[1]||null,
        qty_sold: parseNum(cols[2]),
        item_cogs: parseNum(cols[3]),
        gross_sales: parseNum(cols[4]),
        discount_amount: parseNum(cols[5]),
        refund_amount: parseNum(cols[6]),
        net_sales: parseNum(cols[7]),
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
  return { rows, skipped }
}

// ── Process one file ──────────────────────────────────────────────────────────
async function processFile(filename) {
  const filePath = path.join(INBOX_DIR, filename)
  console.log(`\n${'='.repeat(55)}`)
  console.log(`Processing: ${filename}`)
  console.log(`Time: ${new Date().toLocaleString()}`)

  // Extract date from filename
  const business_date = extractDate(filename)
  if (!business_date) {
    console.error(`  Could not extract date from filename: ${filename}`)
    console.error(`  Rename file to include date, e.g.: items_2026-03-21.csv`)
    return false
  }
  console.log(`  Date: ${business_date}`)

  // Parse CSV
  let rows, skipped
  try {
    ({ rows, skipped } = parseCSV(filePath, business_date))
  } catch(e) {
    console.error(`  Parse error: ${e.message}`)
    return false
  }

  if (!rows.length) {
    console.error(`  No valid rows found in file`)
    return false
  }
  console.log(`  Parsed: ${rows.length} items (skipped ${skipped})`)

  // Upsert menu table
  console.log(`  Upserting into menu table...`)
  const r1 = await sbRequest('menu', rows)
  if (r1.status !== 200 && r1.status !== 201) {
    console.error(`  Menu upsert failed (${r1.status}): ${r1.body}`)
    return false
  }
  console.log(`  Menu: ${rows.length} rows upserted`)

  // Calculate and upsert daily waste totals
  const byDate = {}
  rows.forEach(r => {
    if (!byDate[r.business_date]) byDate[r.business_date] = 0
    byDate[r.business_date] += (r.waste_amount || 0)
  })
  const wasteRows = Object.entries(byDate).map(([date, amount]) => ({
    business_date: date,
    amount: Math.round(amount * 100) / 100
  }))

  const r2 = await sbRequest('daily_waste_%25', wasteRows)
  if (r2.status !== 200 && r2.status !== 201) {
    console.error(`  Waste upsert failed (${r2.status}): ${r2.body}`)
    return false
  }

  // Print summary
  Object.entries(byDate).forEach(([date, waste]) => {
    const net = rows.filter(r => r.business_date === date).reduce((s,r) => s+(r.net_sales||0), 0)
    const pct = net ? (waste/net*100).toFixed(2) : 'n/a'
    console.log(`  ${date}: net $${net.toFixed(2)} | waste $${waste.toFixed(2)} (${pct}%)`)
  })

  return true
}

// ── Move file after import ────────────────────────────────────────────────────
function moveToProcessed(filename) {
  const src  = path.join(INBOX_DIR, filename)
  const dest = path.join(PROCESSED_DIR, filename)
  // If file already exists in processed, add timestamp
  if (fs.existsSync(dest)) {
    const ext  = path.extname(filename)
    const base = path.basename(filename, ext)
    const ts   = new Date().toISOString().slice(0,19).replace(/:/g,'-')
    fs.renameSync(src, path.join(PROCESSED_DIR, `${base}_${ts}${ext}`))
  } else {
    fs.renameSync(src, dest)
  }
  console.log(`  Moved to processed/`)
}

// ── File watcher ──────────────────────────────────────────────────────────────
const processing = new Set()

async function handleFile(filename) {
  if (!filename.toLowerCase().endsWith('.csv')) return
  if (processing.has(filename)) return
  processing.add(filename)

  // Small delay to ensure file is fully written
  await new Promise(r => setTimeout(r, 1500))

  const filePath = path.join(INBOX_DIR, filename)
  if (!fs.existsSync(filePath)) { processing.delete(filename); return }

  try {
    const success = await processFile(filename)
    if (success) {
      moveToProcessed(filename)
      console.log(`  Done! ${filename} imported successfully.`)
    } else {
      console.error(`  Import failed. File left in inbox for retry.`)
    }
  } catch(e) {
    console.error(`  Unexpected error: ${e.message}`)
  }

  processing.delete(filename)
}

// ── Main ──────────────────────────────────────────────────────────────────────
ensureDirs()
console.log('Paris Baguette FR-1554 — CSV Auto-Importer')
console.log('='.repeat(55))
console.log(`Watching: ${INBOX_DIR}`)
console.log(`Processed: ${PROCESSED_DIR}`)
console.log(`\nDrop any Toast CSV export into the inbox folder.`)
console.log(`Files will be imported and moved automatically.\n`)

// Process any existing files in inbox on startup
const existing = fs.readdirSync(INBOX_DIR).filter(f => f.toLowerCase().endsWith('.csv'))
if (existing.length) {
  console.log(`Found ${existing.length} existing file(s) in inbox, processing...`)
  existing.forEach(f => handleFile(f))
}

// Watch for new files
fs.watch(INBOX_DIR, (eventType, filename) => {
  if (eventType === 'rename' && filename) {
    setTimeout(() => handleFile(filename), 500)
  }
})
