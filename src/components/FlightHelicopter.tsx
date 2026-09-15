import { useEffect, useRef } from 'react'

const BODY_SRC='/campaign/h145-forward-flight-rotorless-v4.png'
const ROTOR_SRC='/campaign/h145-five-blade-rotor-v2.png'
const CANVAS_WIDTH=1800
const CANVAS_HEIGHT=1100
const ROTOR_PHASES=16
const PHASE_ANGLE=(Math.PI*2)/ROTOR_PHASES

function loadImage(src:string){
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image()
    image.decoding='async'
    image.onload=()=>resolve(image)
    image.onerror=reject
    image.src=src
  })
}

export default function FlightHelicopter(){
  const canvasRef=useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    const canvas=canvasRef.current
    if(!canvas)return
    const context=canvas.getContext('2d')
    if(!context)return

    let animationFrame=0
    let active=true
    let visible=true
    let body:HTMLImageElement|undefined
    let rotor:HTMLImageElement|undefined
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)')

    const draw=(time:number)=>{
      if(!active||!body||!rotor){animationFrame=0;return}
      context.clearRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT)

      context.globalAlpha=1
      context.globalCompositeOperation='source-over'
      context.save()
      context.translate(CANVAS_WIDTH,0)
      context.scale(-1,1)
      context.drawImage(body,132,62,1536,1024)
      context.restore()

      // The rotor is rendered as part of the same aircraft canvas. Its shallow
      // elliptical plane and phase-changing shutter samples match a real H145
      // rotor seen from a low, front three-quarter camera position.
      const hubX=1048
      const hubY=252
      const rotorDiameter=1690
      const continuousAngle=reducedMotion.matches?.18:time*.0419
      const angle=reducedMotion.matches?.18:Math.floor(continuousAngle/PHASE_ANGLE)*PHASE_ANGLE
      context.save()
      context.translate(hubX,hubY)
      context.transform(1,0,-.08,.205,0,0)
      const samples=reducedMotion.matches?1:12
      for(let sample=samples-1;sample>=0;sample--){
        context.save()
        context.rotate(angle-sample*.033)
        context.globalAlpha=sample===0?.13:.03
        context.drawImage(rotor,-rotorDiameter/2,-rotorDiameter/2,rotorDiameter,rotorDiameter)
        context.restore()
      }
      context.restore()

      // The detailed upper head is sampled from the same rotating frame as the
      // blades. Keeping it sharper than the shutter trail makes the blade grips
      // visibly advance through 16 discrete phases instead of orbiting a frozen
      // rotor head baked into the fuselage.
      context.save()
      context.translate(hubX,hubY)
      context.transform(1,0,-.08,.205,0,0)
      context.rotate(angle)
      context.beginPath()
      context.arc(0,0,112,0,Math.PI*2)
      context.clip()
      context.globalAlpha=.96
      context.drawImage(rotor,-rotorDiameter/2,-rotorDiameter/2,rotorDiameter,rotorDiameter)
      context.restore()

      if(visible&&!reducedMotion.matches)animationFrame=requestAnimationFrame(draw)
      else animationFrame=0
    }

    const observer=new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting
      if(visible&&body&&rotor&&!animationFrame)animationFrame=requestAnimationFrame(draw)
      if(!visible&&animationFrame){cancelAnimationFrame(animationFrame);animationFrame=0}
    },{rootMargin:'120px'})
    observer.observe(canvas)

    Promise.all([loadImage(BODY_SRC),loadImage(ROTOR_SRC)]).then(([bodyImage,rotorImage])=>{
      body=bodyImage
      rotor=rotorImage
      animationFrame=requestAnimationFrame(draw)
    }).catch(()=>{
      canvas.classList.add('is-unavailable')
    })

    const handleMotionChange=()=>{
      if(animationFrame)cancelAnimationFrame(animationFrame)
      animationFrame=requestAnimationFrame(draw)
    }
    reducedMotion.addEventListener?.('change',handleMotionChange)
    return()=>{
      active=false
      observer.disconnect()
      reducedMotion.removeEventListener?.('change',handleMotionChange)
      if(animationFrame)cancelAnimationFrame(animationFrame)
    }
  },[])

  return <canvas ref={canvasRef} className="flight-aircraft flight-helicopter" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} role="img" aria-label="H145 helicopter flying toward the viewer with its five-blade rotor turning"/>
}
