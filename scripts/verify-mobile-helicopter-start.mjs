/** Pure choreography QA for the phone opening pose. */
import assert from 'node:assert/strict'
import { mobileOpeningXOffset, poseAt } from '../src/three/choreography.ts'

const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,`${message}: ${actual} !== ${expected}`)

for(const compositionBase of [0,1.15]){
  const mobileX=poseAt(0).x+compositionBase+mobileOpeningXOffset(0,true,compositionBase)
  close(mobileX,0,`Phone opening is not centred for base ${compositionBase}`)
  close(mobileOpeningXOffset(.24,true,compositionBase),0,`Phone correction does not finish on the authored path for base ${compositionBase}`)
  close(mobileOpeningXOffset(0,false,compositionBase),0,`Desktop choreography changed for base ${compositionBase}`)
}

let previous=-Infinity
for(let index=0;index<=240;index++){
  const progress=index/1000
  const x=poseAt(progress).x+1.15+mobileOpeningXOffset(progress,true,1.15)
  assert.ok(x>=previous-1e-9,`Phone opening reverses at ${progress}`)
  previous=x
}

console.log(JSON.stringify({passed:true,phoneStartsCentred:true,noOpeningReversal:true,desktopUnchanged:true}))
