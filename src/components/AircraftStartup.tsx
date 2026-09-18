/** Lightweight first frame exported from the accepted v6 native aircraft.
 * Only covers loading/failure; it is never presented as an animated 3D model.
 */
export default function AircraftStartup() {
  return <picture className="aircraft-startup" aria-hidden="true">
    <source media="(max-width:760px)" srcSet="/campaign/light-twin/helicopter-start-mobile-v6.webp"/>
    <img src="/campaign/light-twin/helicopter-start-desktop-v6.webp" width="1920" height="1080" alt="" fetchPriority="high" loading="eager"/>
  </picture>
}
