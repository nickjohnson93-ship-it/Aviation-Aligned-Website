/** Pure authored-math/static-source QA. No browser, GPU or rendered assumptions.
 * Run: node --experimental-strip-types scripts/verify-final-flight.mjs
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { heroSequenceAt, helicopterScrollProgress, HERO_HEIGHT_VH, MOBILE_HERO_HEIGHT_VH } from '../src/heroSequence.ts'

const stage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relative => fs.readFile(path.join(stage, relative), 'utf8')
const [css, legacyCss, scene, marketing, main, svg] = await Promise.all([
  read('src/final-flight.css'), read('src/flight-story.css'), read('src/components/FlightPlane.tsx'),
  read('src/pages/MarketingSite.tsx'), read('src/main.tsx'), read('public/brand/aviation-aligned-logo-primary.svg'),
])
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const close = (a, b, label, tolerance = 1e-9) => assert.ok(Math.abs(a-b) < tolerance, `${label}: ${a} != ${b}`)
const viewportResults = []
const warnings = []
const viewports = [[320,568],[390,844],[760,900],[761,900],[1024,768],[1440,900],[1920,1080]]

for (const [width, height] of viewports) {
  const mobile = width <= 760
  const originalDockWidth = (mobile ? clamp(width*.52,180,248) : clamp(width*.34,300,500))*.52
  const originalPhysicalTravel = height*(mobile?2.6:3)
  const sequenceTravel = height*((mobile?MOBILE_HERO_HEIGHT_VH:HERO_HEIGHT_VH)/100-1)
  const helicopterTravel = sequenceTravel*(mobile?.5:3/5.4)
  const largeWidth = Math.min(width*(mobile?.79:.62),760,height*.70*256/214)
  let previousDock = 0, previousWidth = Infinity, maxScale = 0, maxVisibleScale = 0
  let maxOpacity = 0, sampled = 0
  for (let i=-250; i<=1250; i++) {
    const p=i/1000, sequence=heroSequenceAt(p,width,height)
    sampled++
    for (const [key,value] of Object.entries(sequence)) {
      if (typeof value === 'boolean') continue
      assert.ok(Number.isFinite(value), `Non-finite ${key} at ${p},${width}x${height}`)
      if (key.endsWith('Opacity') || key === 'logoDock') assert.ok(value>=0 && value<=1, `${key} outside [0,1]`)
    }
    assert.ok(sequence.planeScale>0 && sequence.logoWidth>0, 'Non-positive rendering size')
    assert.equal(sequence.fansRunning, sequence.planeOpacity>.002, 'Fans do not follow visibility gate')
    if (p<=.10 || p>=.72) {
      close(sequence.planeOpacity,0,'Plane outside its authored phase')
      assert.equal(sequence.fansRunning,false,'Fans running outside plane phase')
    }
    if (p>=.77 && p<=.81) {
      close(sequence.logoOpacity,1,'Large-logo hold opacity')
      close(sequence.logoDock,0,'Logo docks before its large hold ends')
      close(sequence.logoWidth,largeWidth,'Logo shrinks during centre hold')
    }
    if (p>=.81) {
      assert.ok(sequence.logoDock>=previousDock-1e-10,'Logo dock progression reverses')
      assert.ok(sequence.logoWidth<=previousWidth+1e-9,'Docked logo grows unexpectedly')
      previousDock=sequence.logoDock;previousWidth=sequence.logoWidth
    }
    if (p>=.97) {
      close(sequence.logoDock,1,'Logo final dock fraction')
      close(sequence.logoWidth,originalDockWidth,'Original final desktop/mobile physical logo width')
    }
    maxScale=Math.max(maxScale,sequence.planeScale)
    if(sequence.planeOpacity>.002)maxVisibleScale=Math.max(maxVisibleScale,sequence.planeScale)
    maxOpacity=Math.max(maxOpacity,sequence.planeOpacity)
  }
  const starting=heroSequenceAt(0,width,height),arrival=heroSequenceAt(.57,width,height)
  close(starting.planeX,0,'Plane horizontal origin')
  close(starting.planeY,0,'Plane vertical origin')
  close(starting.planeScale,.11,'Plane depth-scale origin')
  const expectedScale=width*.96/(mobile?width*1.55:Math.min(width*.86,1260))
  close(arrival.planeScale,expectedScale,'Screenshot-framed arrival scale')
  close(arrival.planeOpacity,1,'Full approach visibility')
  close(arrival.planeX,-4,'Screenshot-framed arrival x')
  close(arrival.planeY,3.3,'Screenshot-framed arrival y')
  close(arrival.planeRoll,-1,'Screenshot-framed arrival bank')
  for(let p=.57;p<=1;p+=.001) {
    const held=heroSequenceAt(p,width,height)
    for(const key of ['planeScale','planeX','planeY','planeRoll'])close(held[key],arrival[key],'Plane transforms continue past screenshot framing')
    if(p<=.68)close(held.planeOpacity,1,'Plane fades during its screenshot hold')
  }
  close(maxOpacity,1,'Plane never reaches full opacity')
  for (const fraction of [-.5,0,.1,.25,.5,.75,1,1.5,2]) {
    const distance=helicopterTravel*fraction
    close(helicopterScrollProgress(distance,height,mobile),clamp(fraction,0,1),'Compressed helicopter physical scroll progress')
  }
  viewportResults.push({width,height,mobile,samples:sampled,originalHelicopterTravelPx:originalPhysicalTravel,
    sequenceTravelPx:sequenceTravel,sequenceTravelScreens:sequenceTravel/height,helicopterTravelPx:helicopterTravel,
    travelReductionFraction:1-sequenceTravel/(height*(mobile?5.2:5.4)),
    planeApproachScale:arrival.planeScale,oldPlaneMaxScale:.43,approachScaleMultiplier:arrival.planeScale/.43,
    maxFunctionScale:maxScale,maxVisibleScale,largeLogoWidthPx:largeWidth,finalLogoWidthPx:originalDockWidth,
    planeTransformHold:[.57,1],planeFullOpacityHold:[.57,.68],largeLogoHold:[.77,.81],slowDock:[.81,.97],finiteMath:true})
}

assert.equal(HERO_HEIGHT_VH,505,'Unexpected desktop authored hero distance')
assert.equal(MOBILE_HERO_HEIGHT_VH,300,'Unexpected mobile authored hero distance')
assert.match(css,/\.flight-story\s*\{height:505vh;height:505svh\}/,'Desktop hero CSS/math disagree')
assert.match(css,/@media\(max-width:760px\)\{\.flight-story\{height:300vh;height:300svh\}/,'Mobile hero CSS/math disagree')
assert.match(css,/\.flight-stage\{height:100vh;height:100svh\}/,'Stage is not stable against phone address-bar resize')
assert.ok(main.indexOf("'./final-flight.css'")>main.indexOf("'./flight-story.css'"),'Final overrides load before legacy styles')
assert.match(marketing,/progressRef\.current=helicopterScrollProgress\(-rect\.top,stageHeight,window\.innerWidth<=760\)/,'Website does not use compressed physical helicopter mapping')
assert.match(marketing,/heroSequenceAt\(progress,hero\.clientWidth,stageHeight\)/,'Website math receives wrong stable viewport inputs')
assert.match(marketing,/--fan-play-state',value\?'running':'paused'/,'Fan gate is not connected to animation-play-state')
assert.match(marketing,/--logo-dock-progress/,'Logo docking is not connected')
assert.match(marketing,/aviation-aligned-logo-primary\.svg/,'Website does not use crisp native SVG')
assert.match(css,/\.flight-stage \.flight-plane\{[^}]*left:50%;top:50%/,'Plane does not start at stage centre')
assert.match(legacyCss,/\.flight-scene\{[^}]*z-index:4/,'Expected helicopter layer changed')
assert.match(legacyCss,/\.flight-plane\{[^}]*z-index:3/,'Plane is not behind helicopter layer')
assert.match(css,/animation-play-state:var\(--fan-play-state,paused\)/,'Fans are not paused by default/outside phase')
assert.match(scene,/clipPath=\{`url\(#\$\{id\}-annulus\)`\}/,'Fan group is not annulus-clipped')
assert.match(scene,/clipRule="evenodd"/,'Annulus does not subtract spinner core')
assert.match(scene,/M48 0A48 48[^"\n]*M11 0A11 11/,'Annulus outer/inner radii differ from intended intake clip')
assert.match(scene,/const engines=\[\{x:271,y:532,sx:\.81,sy:1,angle:12\},\{x:861,y:643,sx:\.90,sy:1\.10,angle:18\}\]/,'Engine coordinate assumptions changed: repeat visual alignment QA')
const fanAnnuli=[{x:271,y:532,rx:48*.81,ry:48},{x:861,y:643,rx:48*.90,ry:48*1.10}]
fanAnnuli.forEach(engine=>assert.ok(engine.x-engine.rx>0 && engine.x+engine.rx<1536 && engine.y-engine.ry>0 && engine.y+engine.ry<1024,'Fan clip escapes aircraft image extent'))
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'No reduced-motion override')
assert.match(css,/\.flight-stage \.flight-plane,\.plane-engine-motion\{display:none\}/,'Reduced motion leaves aircraft/fan overlay moving')
assert.match(css,/\.plane-fan\{animation:none\}/,'Reduced motion leaves fans animating')
assert.match(css,/\.flight-stage \.flight-wordmark\{[^}]*opacity:1/,'Reduced motion leaves final logo hidden')
assert.match(css,/@media\(max-width:760px\) and \(prefers-reduced-motion:reduce\)[\s\S]*width:clamp\(180px,52vw,248px\)/,'Reduced-motion mobile logo sizing differs from original')
assert.match(svg,/<svg[^>]*viewBox="0 0 256 214"/,'Logo aspect ratio disagrees with size math')
assert.ok((svg.match(/<path\b/g)||[]).length>=15,'Native logo outlines are missing')
assert.ok(!/<(?:image|text|foreignObject)\b/i.test(svg),'Logo contains raster or font-dependent content')
assert.ok(!/@font-face|font-family|data:image|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg),'Logo has external/raster/font dependencies')
assert.ok(!/<rect\b/i.test(svg),'Logo has an opaque background rectangle')

warnings.push('Plane transform stops at progress .57 and stays fixed through its fade .68–.72; the final image width is 96% of the stage, matching the supplied reference composition.')
const report={passed:true,checkedAt:new Date().toISOString(),method:'Pure numeric sequence + static source checks; no browser/GPU/render inputs',
  viewports:viewportResults,centreBehindHelicopter:true,helicopterPathUnchanged:true,helicopterPhysicalScrollMappingUnchanged:false,
  planeAbsentAndFansPausedAfter:.72,nativeSvg:{viewBox:'0 0 256 214',paths:(svg.match(/<path\b/g)||[]).length,
    sha256:createHash('sha256').update(svg).digest('hex'),noRasterFontsOrLiveText:true},
  fans:{outerClipRadius:48,innerSpinnerCutoutRadius:11,fanAnnuli,defaultPaused:true,phaseVisibilityGate:true,
    reducedMotionAnimationDisabled:true,visualIntakeAlignment:'Requires browser review; static/math tests cannot prove photo alignment'},
  reduceMotion:{planeAndFanOverlayHidden:true,finalLogoVisible:true,legacyDockWidthRetained:true},warnings,
  visualLimitations:['Visual pacing, terrain appearance, perceived depth, intake alignment and final logo target placement require rendered browser review.','Static source checks prove the specified layer values/import order, not the browser cascade or GPU output.']}
const output=path.join(stage,'docs/final-flight-math-qa.json')
await fs.mkdir(path.dirname(output),{recursive:true})
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({passed:true,output,viewports:viewports.length,finiteMathSamples:viewportResults.reduce((sum,result)=>sum+result.samples,0),planeArrivalWidthFraction:.96,planeFullOpacityHold:[.57,.68],largeHold:[.77,.81],slowDock:[.81,.97],warnings},null,2))
