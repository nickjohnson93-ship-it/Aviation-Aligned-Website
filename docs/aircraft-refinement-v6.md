# Final screenshot-framing refinement — v6

18 September 2026. This is a narrow follow-up to the accepted v5 mesh and
sequence, not a replacement aircraft or a change to rotor appearance.

The plane approaches the supplied screenshot composition: image width is
96% of the stage, image centre is 46% across and 53.3% down, bank is -1°.
Its transform stops at progress .57, holds fully visible until .68, then
fades without further enlargement or movement. The centred SVG logo and
slow docking sequence remain unchanged. The same full-wing framing fits
mobile; fans remain visible during the hold and pause after the plane fades.

The rear black protrusion was the bottom corner of the added interior
bulkhead. Its lower corners now taper inside the original curved fuselage;
its station, thickness, upper width and cabin-depth role remain intact.
1,104 ray checks across the complete thickness and both lower sides measure
at least 32.49 mm clearance. The source hull, original floor correction,
landing gear, accepted livery, panel details and both protected rotor rigs
are unchanged. The visible native mesh has 51,718 triangles / 97 primitives.

Native asset: `public/campaign/light-twin/light-twin-refined-v6.glb`.
SHA-256: `1a74db3784e1ce30ebe45e1c006349e46858998c0e17010bbdf9c37491becb4c`.
Corresponding source: `aircraft-refinement-source-v6.zip`.
Native validation: `docs/aircraft-refinement-v6-qa.json`.
Sequence validation: `docs/final-flight-math-qa.json`.

The accepted native helicopter is now the default homepage aircraft, rather
than requiring a review query. `aircraft=h145` retains the older optional
scene. Exhaust airflow stays removable; outlined SVG logo quality is unchanged.

Validation preserves all original embedded images, original binary prefix
and protected rotor geometry/materials, plus eight protected runtime spans
and the complete helicopter choreography. No manufacturer-CAD or physical
heat-refraction claim is made. Existing Blender/PNG/MP4 files are historical.
The upstream GPL-2.0 notices/source remain included; Aviation Aligned brand
artwork and website are not relicensed by the aircraft mesh licence.

Reproduce with the supplied lockfile/dependencies:

```
node scripts/build-production-aircraft.mjs
node scripts/verify-final-flight.mjs
node node_modules/typescript/bin/tsc --project tsconfig.app.json --incremental false
node node_modules/vite/bin/vite.js build
```

Publishing target is the separate Aviation-Aligned-Website repository linked
to aviationaligned.com.au. The authenticated portal is not part of this update.
