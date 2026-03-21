const https = require('https')
const CLIENT_ID = process.env.TOAST_CLIENT_ID
const CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET
const REST_GUID = process.env.TOAST_RESTAURANT_GUID
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_KEY
function req(opts, body) {
  return new Promise((res, rej) => {
    const r = https.request(opts, (resp) => {
      let d = ''
      resp.on('data', c => d += c)
      resp.on('end', () => { try { res({s:resp.statusCode,b:JSON.parse(d)}) } catch { res({s:resp.statusCode,b:d}) } })
    })
    r.on('error', rej)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}
async function getToken() {
  const r = await req({hostname:'ws-api.toasttab.com',path:'/authentication/v1/authentication/login',method:'POST',headers:{'Content-Type':'application/json'}},{clientId:CLIENT_ID,clientSecret:CLIENT_SECRET,userAccessType:'TOAST_MACHINE_CLIENT'})
  if (r.s!==200) throw new Error('Auth failed: '+JSON.stringify(r.b))
  return r.b.token.accessToken
}
async function fetchOrders(token, date) {
  let all=[], page=1
  while(true) {
    const r = await req({hostname:'ws-api.toasttab.com',path:'/orders/v2/ordersBulk?businessDate='+date.replace(/-/g,'')+'&page='+page+'&pageSize=100',method:'GET',headers:{'Authorization':'Bearer '+token,'Toast-Restaurant-External-ID':REST_GUID}})
    if (r.s!==200) throw new Error('Orders failed: '+JSON.stringify(r.b))
    const orders = Array.isArray(r.b)?r.b:[]
    all = all.concat(orders)
    console.log('Page '+page+': '+orders.length+' orders')
    if (orders.length<100) break
    page++
  }
  return all
}
function calcMetrics(orders, date) {
  let net=0, count=0
  for (const o of orders) {
    if (o.voided||o.deleted) continue
    for (const c of (o.checks||[])) {
      if (c.voided||c.deleted) continue
      net+=(c.amount||0); count++
    }
  }
  return {business_date:date,'netsales_$':Math.round(net*100)/100,order_count:count,avg_order:count?Math.round(net/count*100)/100:0}
}
async function upsertSupabase(row) {
  const r = await req({hostname:new URL(SB_URL).hostname,path:'/rest/v1/sales',method:'POST',headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'}},[row])
  if (r.s!==200&&r.s!==201) throw new Error('Supabase failed: '+JSON.stringify(r.b))
}
async function main() {
  const missing=['TOAST_CLIENT_ID','TOAST_CLIENT_SECRET','TOAST_RESTAURANT_GUID','SUPABASE_URL','SUPABASE_KEY'].filter(k=>!process.env[k])
  if (missing.length) { console.error('Missing: '+missing.join(', ')); process.exit(1) }
  const d=new Date(); d.setDate(d.getDate()-1)
  const date=process.argv[2]||d.toISOString().slice(0,10)
  console.log('Syncing '+date)
  try {
    const token=await getToken()
    const orders=await fetchOrders(token,date)
    const row=calcMetrics(orders,date)
    await upsertSupabase(row)
    console.log('Done! net: $'+row['netsales_$']+' orders: '+row.order_count)
  } catch(e) { console.error('Failed:',e.message); process.exit(1) }
}
main()