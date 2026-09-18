/** Exact runtime preservation proof. Whole-scene hashes are intentionally not
 * frozen: optional airflow and loading UI may change outside protected spans.
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const baselineUrls = {
  scene: new URL('../.rotor-baseline/LightTwinScene.tsx', import.meta.url),
  loader: new URL('../.rotor-baseline/lightTwin.ts', import.meta.url),
  choreography: new URL('../.rotor-baseline/choreography.ts', import.meta.url),
}
const currentUrls = {
  scene: new URL('../src/components/LightTwinScene.tsx', import.meta.url),
  loader: new URL('../src/three/lightTwin.ts', import.meta.url),
  choreography: new URL('../src/three/choreography.ts', import.meta.url),
}
const protectedSpans = [
  {
    id: 'renderer-camera-lighting-samples-and-initial-angles', file: 'scene',
    start: '    const samples = 48', end: '    const resize = () =>',
  },
  {
    id: 'pose-main-tail-shutter-equations-and-canvas-opacity', file: 'scene',
    start: '      const p = progressRef.current',
    end: '      renderer.domElement.style.opacity = String(motion.matches ? 1 : aircraftOpacity(p))', includeEnd: true,
  },
  {
    // v7 intentionally changes lifecycle: stop hidden rendering and resume
    // on reverse scroll. Angular speeds, dt cap and visible sampling stay exact.
    id: 'rotor-tick-speeds-dt-cap-and-visible-scheduling', file: 'scene',
    start: '      const dt = Math.min', end: '      paint(); frame = requestAnimationFrame(tick)', includeEnd: true,
  },
  {
    id: 'environment-map-loading', file: 'scene',
    start: '    const skyPromise =', end: '    const modelPromise =',
  },
  {
    id: 'protected-rotor-material-tuning', file: 'loader',
    start: '    for (const material of list)', end: '  const replacedGeometries',
  },
  {
    id: 'rotor-sampling-geometry-opacity-and-builder-calls', file: 'loader',
    start: '  function sampledRotor(', end: '  // Collect the original removed parts too',
  },
  {
    id: 'rotor-shadow-and-frustum-policy', file: 'loader',
    start: '  // glTF surfaces use baked paint maps', end: '  return {',
  },
  {
    id: 'rotor-instance-matrix-updates', file: 'loader',
    start: '    updateRotorInstances() {', end: '    dispose() {',
  },
]

const normalizeLF = text => text.replace(/\r\n?/g, '\n')
const sha256 = text => createHash('sha256').update(text).digest('hex')

function extract(text, definition, kind) {
  const start = text.indexOf(definition.start)
  assert.notEqual(start, -1, `${definition.id}: ${kind} start marker is missing`)
  const end = text.indexOf(definition.end, start + definition.start.length)
  assert.notEqual(end, -1, `${definition.id}: ${kind} end marker is missing`)
  return text.slice(start, end + (definition.includeEnd ? definition.end.length : 0))
}

export async function auditProtectedRuntime() {
  const baseline = {}, current = {}
  await Promise.all(Object.keys(baselineUrls).map(async file => {
    baseline[file] = normalizeLF(await fs.readFile(baselineUrls[file], 'utf8'))
    current[file] = normalizeLF(await fs.readFile(currentUrls[file], 'utf8'))
  }))
  const spans = protectedSpans.map(definition => {
    const expected = extract(baseline[definition.file], definition, 'baseline')
    const actual = extract(current[definition.file], definition, 'current')
    assert.equal(actual, expected, `${definition.id}: protected rotor runtime changed`)
    return {
      id: definition.id, file: definition.file,
      baselineSha256: sha256(expected), currentSha256: sha256(actual),
      normalizedUtf8Bytes: Buffer.byteLength(actual), exactMatch: true,
    }
  })
  assert.equal(current.choreography, baseline.choreography, 'Protected flight choreography changed')
  return {
    passed: true, normalization: 'line endings only (LF)',
    protectedSpans: spans,
    choreography: {
      baselineSha256: sha256(baseline.choreography),
      currentSha256: sha256(current.choreography), exactMatch: true,
    },
    note: 'Original visible rotor appearance, sampling, angular speeds and lighting spans are exact. v7 intentionally changes hidden-render lifecycle; optional airflow/loading UI lie outside these spans.',
  }
}
