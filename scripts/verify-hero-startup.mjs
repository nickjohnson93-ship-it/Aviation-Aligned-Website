import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { auditProtectedRuntime } from './audit-protected-runtime.mjs'

const read = name => fs.readFile(new URL('../'+name,import.meta.url),'utf8')
const [html,startup,scene,boundary,css] = await Promise.all([
  read('index.html'),read('src/components/AircraftStartup.tsx'),read('src/components/LightTwinScene.tsx'),
  read('src/components/FlightSceneBoundary.tsx'),read('src/final-flight.css'),
])
for(const size of ['mobile','desktop']) {
  const name=`helicopter-start-${size}-v6.webp`
  const bytes=await fs.readFile(new URL('../public/campaign/light-twin/'+name,import.meta.url))
  assert.equal(bytes.toString('ascii',0,4),'RIFF')
  assert.equal(bytes.toString('ascii',8,12),'WEBP')
  assert.ok(bytes.length<200000,`${size} startup exceeds 200kB`)
  assert.ok(html.includes(name)&&startup.includes(name),'HTML preloads do not match the displayed first frame')
  console.log(`${size} first frame: ${bytes.length} bytes`)
}
assert.match(html,/as="fetch" href="\/campaign\/light-twin\/light-twin-refined-v6\.glb" crossorigin="anonymous"/)
assert.match(html,/as="fetch" href="\/campaign\/light-twin\/flight-sky-1k\.hdr" crossorigin="anonymous"/)
assert.match(startup,/fetchPriority="high" loading="eager"/)
assert.ok(!/forward-flight-review\.png/.test(scene+boundary),'A historical model poster remains in startup/failure UI')
assert.match(css,/\.light-twin-scene\.is-ready \.aircraft-startup\{opacity:0\}/)
assert.match(scene,/if \(opacity <= \.002\) return/)
assert.match(scene,/aircraftOpacity\(progressRef\.current\) > \.002/)
assert.match(scene,/frame = requestAnimationFrame\(\(\) => \{ frame = 0; paint\(\); start\(\) \}\)/)
assert.ok(!/__native-capture|captureRef|Export current helicopter/.test(scene),'Temporary export UI leaked into production')
const model=await fs.readFile(new URL('../public/campaign/light-twin/light-twin-refined-v6.glb',import.meta.url))
assert.equal(createHash('sha256').update(model).digest('hex'),'1a74db3784e1ce30ebe45e1c006349e46858998c0e17010bbdf9c37491becb4c','Accepted native model changed')
console.log(JSON.stringify({passed:true,nativeModelUnchanged:true,protectedVisibleRotorRuntime:await auditProtectedRuntime()},null,2))
