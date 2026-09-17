# Aviation Aligned — free light-twin mesh experiment

## 18 September 2026 — screenshot-framing and rear-bulkhead refinement v6

Current native asset: `light-twin-refined-v6.glb`; matching corresponding
source: `aircraft-refinement-source-v6.zip`. The plane holds at the user's
reference framing and fades without further movement. The rear interior
bulkhead's lower corners taper inside the measured original fuselage. The
accepted source hull, rotor rigs/materials/runtime, livery and detailing
remain intact. See `docs/aircraft-refinement-v6.md` and the v6 native QA report.
The accepted native helicopter is now the default homepage aircraft. All
earlier dated records below are historical; original copyright and GPL-2.0
licence notices/source are retained. Brand artwork remains Aviation Aligned's.

## 17 September 2026 — final native refinement and sequence v5

The latest local review candidate is `light-twin-refined-v5.glb`, with matching
`aircraft-refinement-source-v5.zip`. See `docs/aircraft-refinement-v5.md`, the
v5 native QA report, the sequence mathematics report and the content QA report.
Original rotor meshes and their runtime appearance remain unchanged. The two
user-marked lower attachments are reversibly hidden; the oversized interior
floor is enclosed inside the original curved hull. No fuselage/window/landing
gear replacement or AI aircraft bitmap is used. The plane's longer approach,
subtle intake fan overlay and outlined vector-logo handoff are website code.
The logo remains Aviation Aligned's artwork; enlarging it uses native vector
paths, not an upscaled raster. Exhaust airflow remains optional and removable.

All prior sections below are historical dated records, not current v5 renders.
Original copyright/licence notices and GPL source remain available. No website
or portal deployment is performed by this local final QA pass.

## 17 September 2026 — native fine-detail refinement v4

The current review candidate is `light-twin-refined-v4.glb`. Its corresponding
GPL mesh/refinement source is `aircraft-refinement-source-v4.zip`; see
`docs/aircraft-refinement-v4.md` and the v4 QA report. Door/cowling joins,
recessed intakes and the user-requested Aviation Aligned reverse monogram are
native surface details. Optional exhaust airflow is removable website code,
not baked into the GLB. Original rotors and runtime motion/blur are preserved.
Brand artwork remains Aviation Aligned's. Original review PNG/MP4/Blender files
remain historical, not v4 renders. No original licence terms are removed.

## 17 September 2026 — native refinement v3

The website's current review candidate is `light-twin-refined-v3.glb`.
`aircraft-refinement-source-v3.zip` contains the original GPL source and the
native geometry/material refinement and append-only export scripts. See
`docs/aircraft-refinement-v3.md` in that package for changes, rotor-preservation
proofs and acceptance limits. Earlier `.blend`, PNG and MP4 renders below are
historical source/review assets, not renders of v3. The source remains
EC135 P2-class; this is not a type-certified or exact H145 replica.

This is a separate review candidate, not a production-approved photorealistic H145.
The existing cinematic website and Claude procedural branch are preserved.
No paid models were copied, purchased or extracted. No website was deployed.

## Deliverables

- `output/light-twin-study.blend`: editable source scene with custom paint, lighting and actual rotor animation.
- `output/light-twin-web.blend`: baked-material scene for web export.
- `output/light-twin-review.blend`: compact editable baked scene with packed 1K lighting.
- `output/light-twin-web.glb`: web mesh with `MainRotor_RIG` and `TailRotor_RIG` pivots.
- `output/forward-flight-review.png`: Cycles render, transparent background.
- `output/geometry-review.png`: the same model with motion blur disabled.
- `output/rig-qa.json`: measured pivot/radius invariance and 3-second loop checks.
- `output/light-twin-motion-review.mp4`: an offline actual-rig animation review, not a recording of the website. Surface-detail revisions after this render starts are not retroactively included in it.

## Geometry provenance and licence

The airframe and original panel/rivet maps are by **Heiko Schulz**, from
https://github.com/HHS81/ec135 at commit
`6c502e2a8772c3e796706f59f78ee626071a75d6`.
This is an **EC135 P2-class** light twin, not an exact H145. Four main blades and
a ten-blade ducted tail rotor are used. The aircraft model, associated modified
textures and derived mesh retain the upstream **GNU GPL version 2** licence.
See `upstream-ec135/LICENSE`, `README.md` and `ReadMeFirst` for original notices.
No simulator sounds, scripts or operational aircraft systems are executed.

Conversion/parser scripts, the modified mesh, paint and rigid animation rig in
this experiment are supplied under GPL-2.0 as well. The source package includes
the original mesh and map files, the conversion and export scripts and this
record of changes. Keep it available alongside any distributed derived mesh.
The rest of the website has not been relicensed by this experiment.

This licence is permission to use the supplied model, not a promise of Airbus
endorsement, trademark clearance, exact manufacturing accuracy, or certification.
Do not advertise the model as a digital twin or an operational simulation.

## Lighting provenance

`kloppenheim_06_puresky_4k.exr`, by Greg Zaal with sky edits by Jarod Guest:
https://polyhaven.com/a/kloppenheim_06_puresky — **CC0**.
https://polyhaven.com/license
The lighting is free/public-domain, not an exclusive Aviation Aligned asset.
`output/flight-sky-1k.hdr` is its reduced website lighting export.

## What changed

The AC3D mesh was converted to glTF/Blender coordinates. Optional simulator
equipment and baked rotor discs were excluded. Duplicate vertices were welded,
normals corrected, glazing given physical thickness and tint, cabin depth/seats
added, and a restrained original navy/gold livery created and baked. Real surface
normal maps preserve panel seams and fastener detail. Both rotor meshes were
recentered at physical pivots so motion blur does not swing the tail blades out
of their duct. The actual head, blades and pitch links rotate. This is a visual
rig, not a mechanically validated swashplate/flight-dynamics model.

The web renderer samples the actual 3D blade surfaces across a virtual shutter
interval for motion blur; it does not place circles or unrelated blades over a
photograph. All samples retain depth against the fuselage. Rig speed is elapsed-
time driven, independently of scroll. Approximate visual speeds: main 400 rpm,
tail 3480 rpm. These are rendering settings, not certified aircraft parameters.

## Reproduce

Run the supplied scripts with portable Blender 4.5.3, in this order:
`build_aircraft.py`, `export_web.py`, `finalize.py`, optionally `render_motion.py`.
For the matching sky, first download the CC0 asset to the lab root as
`kloppenheim_06_puresky_4k.exr`:
https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/4k/kloppenheim_06_puresky_4k.exr .
The compact review scene already contains the reduced lighting; the large source
sky is not bundled into the handoff.
`ac3d.py` is a standalone mesh-format parser. Blender itself is not bundled into
the handoff: https://www.blender.org/download/ .
The local downloaded official Blender zip was SHA256-checked against the
official release manifest before execution.

## Acceptance boundary

Rig operation and successful compilation are not proof of premium realism.
Review the browser rendering separately from Cycles stills. Do not promote this
candidate just because a technical check passes. Exact H145 likeness, convincing
close-up surface finish, rotor appearance, aircraft choreography and mobile
performance remain visual acceptance questions for the user.
