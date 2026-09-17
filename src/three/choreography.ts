// Scroll choreography for the hero. Progress 0..1 is the pinned hero's scroll
// position; the aircraft path is authored as keyframes in world metres so the
// motion stays perspective-correct rather than being a 2D slide.

export type Pose={x:number,y:number,z:number,yaw:number,pitch:number,roll:number}

type Key=Pose&{p:number}

// The H145 starts large and close, high and just left of centre, nose angled
// toward the camera. It closes on the camera, banks into a right turn and
// leaves frame to the right. Nose leads, tail trails throughout.
const HELI:Key[]=[
  {p:.00,x:-1.8,y:3.00,z:-19.5,yaw:-0.86,pitch:.045,roll:.015},
  {p:.12,x:-0.2,y:2.85,z:-17.6,yaw:-0.80,pitch:.038,roll:.055},
  {p:.24,x: 2.6,y:2.55,z:-15.8,yaw:-0.68,pitch:.022,roll:.130},
  {p:.36,x: 5.4,y:1.95,z:-15.0,yaw:-0.46,pitch:.004,roll:.200},
  {p:.48,x:12.5,y:0.90,z:-15.8,yaw:-0.26,pitch:-.012,roll:.165},
  {p:.60,x:24.0,y:-0.6,z:-17.0,yaw:-0.12,pitch:-.018,roll:.085},
]

function ease(t:number){return t*t*(3-2*t)}

export function poseAt(p:number):Pose{
  const k=HELI
  if(p<=k[0].p)return k[0]
  if(p>=k[k.length-1].p)return k[k.length-1]
  let i=0
  while(i<k.length-2&&p>k[i+1].p)i++
  const a=k[i],b=k[i+1]
  const t=ease((p-a.p)/(b.p-a.p))
  return{
    x:a.x+(b.x-a.x)*t,
    y:a.y+(b.y-a.y)*t,
    z:a.z+(b.z-a.z)*t,
    yaw:a.yaw+(b.yaw-a.yaw)*t,
    pitch:a.pitch+(b.pitch-a.pitch)*t,
    roll:a.roll+(b.roll-a.roll)*t,
  }
}

/** Reduced-motion still: the aircraft held at a composed three-quarter pose. */
export const STILL_POSE:Pose={x:-.4,y:2.7,z:-17.4,yaw:-0.78,pitch:.03,roll:.05}

/** Canvas opacity: fades in on load, fades out once the aircraft has cleared. */
export function aircraftOpacity(p:number){
  if(p<=.46)return 1
  return Math.max(0,1-(p-.46)/.10)
}
