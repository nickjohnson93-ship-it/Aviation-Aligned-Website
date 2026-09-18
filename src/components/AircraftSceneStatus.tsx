/** Never silently present the historical poster as the current 3D model. */
export default function AircraftSceneStatus({ failed = false }: { failed?: boolean }) {
  return <div className={`aircraft-scene-status${failed?' is-failed':''}`} role="status" aria-live="polite">
    <span>{failed ? '3D aircraft unavailable — static preview' : 'Loading 3D aircraft…'}</span>
    {failed && <button type="button" onClick={() => window.location.reload()}>Reload aircraft</button>}
  </div>
}
