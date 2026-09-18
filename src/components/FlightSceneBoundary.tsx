import { Component, Suspense, lazy, useEffect, useState, type MutableRefObject, type ReactNode } from 'react'
import AircraftSceneStatus from './AircraftSceneStatus'
import AircraftStartup from './AircraftStartup'

const FlightScene=lazy(()=>import('./FlightScene'))
const lightTwinPreview=new URLSearchParams(window.location.search).get('aircraft')!=='h145'
// Start fetching the selected scene as soon as the entry module runs, rather
// than waiting for React's first render. Model/HDR requests start in the HTML.
const lightTwinModule=lightTwinPreview?import('./LightTwinScene'):undefined
const LightTwinScene=lazy(()=>lightTwinModule??import('./LightTwinScene'))

// Loading and failed static-preview states are explicit: a stale lazy chunk
// must not silently present the historical image as the latest native model.
const fallback=lightTwinPreview?<><div className="flight-scene light-twin-scene is-loading" role="img" aria-label="EC135-class helicopter, static first frame while 3D loads"><AircraftStartup/></div><AircraftSceneStatus/></>:<div className="flight-scene is-unavailable" role="img" aria-label="An Airbus H145 helicopter in forward flight"/>
const unavailable=lightTwinPreview?<><div className="flight-scene light-twin-scene is-loading" role="img" aria-label="Current EC135-class helicopter static preview; 3D unavailable"><AircraftStartup/></div><AircraftSceneStatus failed/></>:fallback

class Boundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return{failed:true}}
  componentDidCatch(error:Error){console.warn('Aircraft scene could not load',error)}
  render(){return this.state.failed?unavailable:this.props.children}
}

export default function FlightSceneBoundary({progressRef}:{progressRef:MutableRefObject<number>}){
  const [showExhaustControl,setShowExhaustControl]=useState(()=>progressRef.current<.56&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{
    if(!lightTwinPreview)return
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)')
    let eventFrame=0,settleFrame=0
    const readVisibility=()=>{
      settleFrame=0
      const next=progressRef.current<.56&&!motion.matches
      setShowExhaustControl(previous=>previous===next?previous:next)
    }
    const scheduleVisibility=()=>{
      if(eventFrame||settleFrame)return
      // The hero updates its mutable progress in a scroll animation frame.
      // Settle once after that frame, even for a single large scrollbar jump.
      // These checks are event-driven, not a continuing animation/poll loop.
      eventFrame=requestAnimationFrame(()=>{
        eventFrame=0
        settleFrame=requestAnimationFrame(readVisibility)
      })
    }
    scheduleVisibility()
    window.addEventListener('scroll',scheduleVisibility,{passive:true})
    window.addEventListener('resize',scheduleVisibility)
    motion.addEventListener('change',scheduleVisibility)
    return()=>{
      window.removeEventListener('scroll',scheduleVisibility)
      window.removeEventListener('resize',scheduleVisibility)
      motion.removeEventListener('change',scheduleVisibility)
      if(eventFrame)cancelAnimationFrame(eventFrame)
      if(settleFrame)cancelAnimationFrame(settleFrame)
    }
  },[progressRef])
  const [exhaustEnabled,setExhaustEnabled]=useState(()=>{
    const explicit=new URLSearchParams(window.location.search).get('exhaust')
    if(explicit==='off')return false
    if(explicit==='on')return true
    try{return window.localStorage.getItem('aviation-exhaust-airflow')!=='off'}catch{return true}
  })
  const toggleExhaust=()=>setExhaustEnabled(value=>{
    const next=!value
    try{window.localStorage.setItem('aviation-exhaust-airflow',next?'on':'off')}catch{/* optional preference */}
    return next
  })
  return <><Boundary><Suspense fallback={fallback}>{lightTwinPreview?<LightTwinScene progressRef={progressRef} exhaustEnabled={exhaustEnabled}/>:<FlightScene progressRef={progressRef}/>}</Suspense></Boundary>
    {lightTwinPreview&&<button type="button" className="exhaust-airflow-control" hidden={!showExhaustControl} disabled={!showExhaustControl} aria-pressed={exhaustEnabled} onClick={toggleExhaust}>Exhaust airflow: {exhaustEnabled?'on':'off'}</button>}
  </>
}
