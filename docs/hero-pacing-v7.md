# Hero pacing and fast startup — v7

18 September 2026. Marketing website only; portal unchanged.

- Phone scroll travel: 520 → 200 small-viewport-height units (61.54% shorter).
  One full-screen scroll reaches the plane approach; two reach the logo finish.
- Desktop travel: 540 → 405 viewport-height units (25% shorter), targeting the
  requested reduction from four wheel rolls to roughly three.
- Gestures vary by operating system, wheel settings, velocity and momentum.
  No touch/wheel interception, artificial snapping or scroll locking is used.
- `svh` pins the stage and travel to the phone's stable small viewport instead
  of stretching the sequence whenever browser chrome appears/disappears.
  The JavaScript reads the actual stage height, with `vh` fallback in CSS.
- Current v6 native-rendered transparent WebP startup frames are preloaded in
  HTML: phone 37,054 bytes, desktop 146,844 bytes. They show while 3D loads and
  fade out when it is ready. Model/HDR fetches are also preloaded; the selected
  scene chunk starts loading immediately when the entry module executes.
- Network loading can never literally be instantaneous. The lightweight first
  frame removes the blank wait for the much larger WebGL asset, without claiming
  the full animation is already loaded. Failure states explicitly say static
  preview and provide a reload control; historical model images are not used.
- Hidden helicopter rendering stops after its departure, including the pinned
  plane/logo phases, and resumes on reverse scroll. Visible rotor speeds,
  sampling, shading, shadows, geometry, native livery and path remain unchanged.
- Native GLB remains byte-identical v6 (SHA-256
  `1a74db3784e1ce30ebe45e1c006349e46858998c0e17010bbdf9c37491becb4c`).
  Its GPL-2.0 mesh source archive remains v6. Current runtime and QA scripts are
  available in this public repository; v7 does not claim to change the mesh.
- Plane screenshot framing/hold, fan clipping and native SVG logo are unchanged.

Checks: production TypeScript/Vite build; 10,507 finite numeric sequence samples
across seven viewports; both startup sizes/preloads; eight exact protected visible
rotor-runtime spans and the full native choreography; browser loading-to-3D
handoff, phone two-screen finish, desktop arrival framing, no horizontal overflow,
hidden renderer stopping and reverse-scroll resumption. Responsive browser checks
are not a benchmark on every physical phone or a guarantee of identical gestures.

Reproduce: `node scripts/verify-final-flight.mjs` and
`node scripts/verify-hero-startup.mjs`.
