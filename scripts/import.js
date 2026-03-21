// Run: node scripts/import.js path/to/file.csv
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://iofqztuvehflpgaxjplt.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZnF6dHV2ZWhmbHBnYXhqcGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIzNDMsImV4cCI6MjA4OTY1ODM0M30.Op9_PzpQV4OgCvVKCueGKp7DNCXRV7JYM_dqOf2wfLI'

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/import.js <csv-file>'); process.exit(1) }

const text = fs.readFileSync(path.resolve(file), 'utf8')
const lines = text.trim().split('\n')
const headers = lines[0].replace(/\r/,'').split(',')

function parseNum(s) {
  if (!s) return null
  return parseFloat(s.replace(/[$,"'\s]/g, '')) || null
}

function parseDate(s) {
  s = s.replace(/"/g,'').trim()
  const d = new Date(s)
  if (!isNaN(d)) return d.toISOString().slice(0,10)
  // Try "Mon Jan 01, 2026" format
  const m = s.match(/\w+\s+(\w+)\s+(\d+),?\s+(\d{4})/)
  if (m) return new Date(`${m[1]} ${m[2]} ${m[3]}`).toISOString().slice(0,10)
  return null
}

const rows = []
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].replace(/\r/,'').match(/(".*?"|[^,]+)/g) || []
  const clean = cols.map(c => c.replace(/^"|"$/g,'').trim())
  const date = parseDate(clean[0])
  if (!date) continue
  rows.push({
    'business_date': date,
    'netsales_$': parseNum(clean[1]),
    'order_count': parseNum(clean[2]) ? Math.round(parseNum(clean[2])) : null,
    'avg_order': parseNum(clean[3])
  })
}

console.log(`Parsed ${rows.length} rows. Uploading...`)

fetch(`${SUPABASE_URL}/rest/v1/sales`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  },
  body: JSON.stringify(rows)
}).then(async r => {
  if (r.ok) console.log(`✓ Uploaded ${rows.length} rows successfully`)
  else console.error('Error:', await r.text())
})
