const https = require('https')
const CLIENT_ID = process.env.TOAST_CLIENT_ID
const CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET
const REST_GUID = process.env.TOAST_RESTAURANT_GUID
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_KEY

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, (resp) => {
      let d = ''
      resp.on('data', c => d += c)
      resp.on('end', () => { try { resolve({s:resp.statusCode,b:JSON.parse(d)}) } catch { resolve({s:resp.statusCode,b:d}) } })
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

async function getToken() {
  console.log('Authenticating with Toast...')
  const r = await req({hostname:'ws-api.toasttab.com',path:'/authentication/v1/authentication/login',method:'POST',headers:{'Content-Type':'application/json'}},{clientId:CLIENT_ID,clientSecret:CLIENT_SECRET,userAccessType:'TOAST_MACHINE_CLIENT'})
  if (r.s!==200) throw new Error('Auth failed: '+JSON.stringify(r.b))
  console.log('Authenticated!')
  return r.b.token.accessToken
}

async function fetchAllOrders(token, date) {
  const dateParam = date.replace(/-/g,'')
  console.log('Fetching orders for '+date+'...')
  let all=[], page=1
  while(true) {
    const r = await req({hostname:'ws-api.toasttab.com',path:'/orders/v2/ordersBulk?businessDate='+dateParam+'&page='+page+'&pageSize=100',method:'GET',headers:{'Authorization':'Bearer '+token,'Toast-Restaurant-External-ID':REST_GUID}})
    if (r.s!==200) throw new Error('Orders failed ('+r.s+'): '+JSON.stringify(r.b))
    const orders = Array.isArray(r.b)?r.b:[]
    all = all.concat(orders)
    console.log('  Page '+page+': '+orders.length+' orders (total: '+all.length+')')
    if (orders.length<100) break
    page++
  }
  console.log('Total orders fetched: '+all.length)
  return all
}

function aggregateData(orders, date) {
  let totalNet=0, totalCount=0
  const hourly = {}
  const items = {}     // item_name -> {quantity, net_sales}
  const waste = {}     // item_name -> {waste_count, waste_amount}

  for (const o of orders) {
    if (o.deleted) continue

    // Excess-food / waste-tracking orders: NOT voided, NOT regular guest sales.
    // Toast creates one of these per day per restaurant when waste is logged in the POS.
    // Each selection is discounted 100% by a "Waste" discount; preDiscountPrice retains
    // the pre-discount (i.e. real) value of the wasted item.
    if (o.excessFood) {
      for (const c of (o.checks||[])) {
        if (c.deleted) continue
        for (const sel of (c.selections||[])) {
          const name = sel.displayName || 'Unknown'
          const qty = sel.quantity || 1
          // preDiscountPrice is the gross sale price for the whole selection line
          // (already accounts for quantity) -- do NOT multiply by qty again.
          const amt = (sel.preDiscountPrice != null ? sel.preDiscountPrice : (sel.price || 0) * qty)
          if (!waste[name]) waste[name] = { waste_count: 0, waste_amount: 0 }
          waste[name].waste_count += qty
          waste[name].waste_amount += amt
        }
      }
      continue
    }

    if (o.voided) continue
    let hour = null
    if (o.openedDate) {
      const utcHour = parseInt(o.openedDate.substring(11,13))
      hour = ((utcHour - 5) + 24) % 24
    }
    for (const c of (o.checks||[])) {
      if (c.voided||c.deleted) continue
      const amt = c.amount||0
      const discounts = (c.appliedDiscounts||[]).reduce((s,d) => s+(d.discountAmount||0), 0)
      const netAmt = amt - discounts
      totalNet += netAmt
      totalCount++
      if (hour !== null) {
        if (!hourly[hour]) hourly[hour] = {net_sales:0,order_count:0}
        hourly[hour].net_sales += netAmt
        hourly[hour].order_count++
      }
      for (const sel of (c.selections||[])) {
        if (sel.voided) continue
        const name = sel.displayName||'Unknown'
        const qty = sel.quantity||1
        const price = (sel.price||0)*qty
        if (!items[name]) items[name] = {quantity:0,net_sales:0}
        items[name].quantity += qty
        items[name].net_sales += price
      }
    }
  }

  const dailyRow = {
    business_date: date,
    'netsales_$': Math.round(totalNet*100)/100,
    order_count: totalCount,
    avg_order: totalCount ? Math.round(totalNet/totalCount*100)/100 : 0
  }

  const hourlyRows = Object.entries(hourly).map(([h,v]) => ({
    business_date: date,
    hour: parseInt(h),
    net_sales: Math.round(v.net_sales*100)/100,
    order_count: v.order_count
  }))

  const itemRows = Object.entries(items).map(([name,v]) => ({
    business_date: date,
    item_name: name,
    quantity: Math.round(v.quantity*100)/100,
    net_sales: Math.round(v.net_sales*100)/100
  }))

  // menu table rows: merge item sales + waste by item_name so the waste dashboard
  // (which reads from `menu`) gets fed automatically, no manual Product Mix export needed.
  const allItemNames = new Set([...Object.keys(items), ...Object.keys(waste)])
  const menuRows = [...allItemNames].map(name => {
    const s = items[name] || { quantity: 0, net_sales: 0 }
    const w = waste[name] || { waste_count: 0, waste_amount: 0 }
    return {
      business_date: date,
      item_name: name,
      qty_sold: Math.round(s.quantity*100)/100,
      net_sales: Math.round(s.net_sales*100)/100,
      waste_count: Math.round(w.waste_count*100)/100,
      waste_amount: Math.round(w.waste_amount*100)/100,
    }
  })

  return { dailyRow, hourlyRows, itemRows, menuRows }
}

async function upsertSupabase(table, rows, conflictCols) {
  if (!rows.length) { console.log('No rows for '+table); return }
  console.log('Upserting '+rows.length+' rows into '+table+'...')
  const path = '/rest/v1/'+table+(conflictCols ? '?on_conflict='+conflictCols : '')
  const r = await req({
    hostname: new URL(SB_URL).hostname,
    path,
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer '+SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    }
  }, rows)
  if (r.s!==200&&r.s!==201) throw new Error(table+' upsert failed ('+r.s+'): '+JSON.stringify(r.b))
  console.log('  '+table+' done!')
}

async function main() {
  console.log('Paris Baguette FR-1554 - Full Nightly Sync v3 (with waste)')
  console.log('='.repeat(50))
  const missing=['TOAST_CLIENT_ID','TOAST_CLIENT_SECRET','TOAST_RESTAURANT_GUID','SUPABASE_URL','SUPABASE_KEY'].filter(k=>!process.env[k])
  if (missing.length) { console.error('Missing secrets: '+missing.join(', ')); process.exit(1) }
  const d = new Date(); d.setDate(d.getDate()-1)
  const date = process.argv[2]||d.toISOString().slice(0,10)
  console.log('Target date: '+date+'\n')
  try {
    const token = await getToken()
    const orders = await fetchAllOrders(token, date)
    const {dailyRow, hourlyRows, itemRows, menuRows} = aggregateData(orders, date)
    const totalWasteAmt = menuRows.reduce((s,r)=>s+(r.waste_amount||0),0)
    const totalWasteQty = menuRows.reduce((s,r)=>s+(r.waste_count||0),0)
    console.log('\nResults:')
    console.log('  Daily: $'+dailyRow['netsales_$']+' | '+dailyRow.order_count+' orders | AOV $'+dailyRow.avg_order)
    console.log('  Hourly: '+hourlyRows.length+' hours')
    console.log('  Items: '+itemRows.length+' unique items')
    console.log('  Waste: '+totalWasteQty+' units / $'+totalWasteAmt.toFixed(2)+' across '+menuRows.filter(r=>r.waste_count>0).length+' items')
    await upsertSupabase('sales', [dailyRow], 'business_date')
    await upsertSupabase('hourly_sales', hourlyRows, 'business_date,hour')
    await upsertSupabase('item_sales', itemRows, 'business_date,item_name')
    await upsertSupabase('menu', menuRows, 'business_date,item_name')
    console.log('\nSync complete!')
  } catch(e) {
    console.error('Sync failed:', e.message)
    process.exit(1)
  }
}
main()
