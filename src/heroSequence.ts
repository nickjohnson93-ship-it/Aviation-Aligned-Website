/** Scroll-authored plane approach and vector-logo handoff.
 * Helicopter progress stays on its original physical scroll distance.
 */
export const HERO_HEIGHT_VH = 640
export const MOBILE_HERO_HEIGHT_VH = 620
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const interval = (p: number, a: number, b: number) => clamp((p-a)/(b-a))
const ease = (n: number) => n*n*(3-2*n)
const mix = (a: number,b: number,t: number) => a+(b-a)*t

export function heroSequenceAt(progress: number, width: number, height: number) {
  const p=clamp(progress),mobile=width<=760
  const approach=ease(interval(p,.12,.57))
  // Screenshot framing: image centre 46% / 53.3%, wings about 96% of
  // the stage width. Hold all transforms before fading into the logo.
  const planeBaseWidth=mobile?width*1.55:Math.min(width*.86,1260)
  const arrivalScale=width*.96/planeBaseWidth
  const exit=ease(interval(p,.68,.72))
  const planeOpacity=Math.min(ease(interval(p,.10,.18)),1-exit)
  const logoOpacity=ease(interval(p,.72,.765))
  const dock=ease(interval(p,.81,.97))
  const largeWidth=Math.min(width*(mobile?.79:.62),760,height*.70*256/214)
  const finalWidth=(mobile?Math.min(248,Math.max(180,width*.52)):Math.min(500,Math.max(300,width*.34)))*.52
  return {
    planeOpacity,planeScale:mix(.11,arrivalScale,approach),
    planeX:mix(0,-4,approach),
    planeY:mix(0,3.3,approach),
    planeRoll:mix(-2,-1,approach),
    fansRunning:planeOpacity>.002,
    logoOpacity,logoDock:dock,logoWidth:mix(largeWidth,finalWidth,dock),
    terrainOpacity:1-ease(interval(p,.68,.76)),
    brandBackgroundOpacity:ease(interval(p,.68,.76)),
    gridOpacity:mix(0,.31,ease(interval(p,.75,.9))),
    targetOpacity:mix(0,.34,ease(interval(p,.77,.93))),
    manifestoOpacity:ease(interval(p,.945,.995)),
  }
}

export function helicopterScrollProgress(scrollDistance: number, height: number, mobile: boolean) {
  return clamp(scrollDistance/Math.max(1,height*(mobile?2.6:3)))
}
