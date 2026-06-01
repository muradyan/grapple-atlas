import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const b = await chromium.launch()
const p = await b.newPage()
await p.goto('https://eel.is/GrappleMap/index.html', { waitUntil:'domcontentloaded', timeout:60000 })
await p.waitForFunction(() => window.db?.nodes?.length>0, { timeout:120000 })
const graph = await p.evaluate(() => {
  const db = window.db
  const transKey = Object.keys(db).find(k=>Array.isArray(db[k]) && db[k][0] && 'from' in db[k][0])
  const T = db[transKey]
  const nodes = db.nodes.map(n => ({ id:n.id, tags:n.tags, name:(Array.isArray(n.desc_lines)?n.desc_lines.join(" "):String(n.desc_lines||"")), out:(n.outgoing||[]).map(o=>({t:o.transition,rev:o.reverse})), x:n.x, y:n.y }))
  const trans = T.map(t => ({ id:t.id, from:t.from, to:t.to, props:t.properties||[], tags:t.tags, name:(Array.isArray(t.desc_lines)?t.desc_lines.join(" "):String(t.desc_lines||"")) }))
  return { nodes, trans }
})
writeFileSync('/tmp/grapplemap-graph.json', JSON.stringify(graph))
// stats
const propCount={}, tagCount={}
for(const t of graph.trans){ for(const pr of t.props) propCount[pr]=(propCount[pr]||0)+1 }
for(const n of graph.nodes){ for(const tg of n.tags) tagCount[tg]=(tagCount[tg]||0)+1 }
console.log('nodes:', graph.nodes.length, ' transitions:', graph.trans.length)
console.log('transition properties (agency):', propCount)
const top=Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,18)
console.log('top node tags:', top.map(([k,v])=>`${k}:${v}`).join(', '))
await b.close()
