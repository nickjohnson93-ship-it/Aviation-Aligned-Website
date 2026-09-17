import { useId } from 'react'

const blades=Array.from({length:22},(_,i)=>i*360/22)
// Mouth centres measured against the existing 1536 x 1024 hero asset. The
// nacelle rims, spinner and the aircraft image remain untouched. Only quiet
// annular fan highlights move, clipped inside the existing intake openings.
const engines=[{x:271,y:532,sx:.81,sy:1,angle:12},{x:861,y:643,sx:.90,sy:1.10,angle:18}]

export default function FlightPlane() {
  const id=useId().replace(/:/g,'')
  const fans=new URLSearchParams(window.location.search).get('fans')!=='off'
  return <div className="flight-aircraft flight-plane" role="img" aria-label="A regional jet approaching">
    <img src="/campaign/regional-jet-hero.webp" width="1536" height="1024" decoding="async" alt=""/>
    {fans&&<svg className="plane-engine-motion" viewBox="0 0 1536 1024" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-blade`}><stop offset=".18" stopColor="#263541" stopOpacity="0"/><stop offset=".62" stopColor="#6f8190" stopOpacity=".32"/><stop offset="1" stopColor="#27333e" stopOpacity=".15"/></radialGradient>
        <clipPath id={`${id}-annulus`}><path clipRule="evenodd" d="M48 0A48 48 0 1 0-48 0A48 48 0 1 0 48 0M11 0A11 11 0 1 1-11 0A11 11 0 1 1 11 0Z"/></clipPath>
        <filter id={`${id}-soft`} x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation=".65"/></filter>
      </defs>
      {engines.map((engine,i)=><g key={i} transform={`translate(${engine.x} ${engine.y}) rotate(${engine.angle}) scale(${engine.sx} ${engine.sy})`} clipPath={`url(#${id}-annulus)`}>
        <g className={`plane-fan fan-${i}`} filter={`url(#${id}-soft)`} fill={`url(#${id}-blade)`}>
          {blades.map(angle=><path key={angle} transform={`rotate(${angle})`} d="M-2-11C1-24 11-34 8-47L2-48C3-32-8-23-5-12Z"/>)}
        </g>
      </g>)}
    </svg>}
  </div>
}
