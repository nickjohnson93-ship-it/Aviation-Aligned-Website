import { Component, Suspense, lazy, type MutableRefObject, type ReactNode } from 'react'
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
  // Keep the effect available without placing a control over the hero. The
  // query switch is useful for review and can be removed without touching UI.
  const exhaustEnabled=new URLSearchParams(window.location.search).get('exhaust')!=='off'
  return <Boundary><Suspense fallback={fallback}>{lightTwinPreview?<LightTwinScene progressRef={progressRef} exhaustEnabled={exhaustEnabled}/>:<FlightScene progressRef={progressRef}/>}</Suspense></Boundary>
}
