# Aviation Aligned cinematic hero — implementation brief

## Objective

Create a premium, scroll-controlled opening sequence that reads as real aviation footage: an H145 in powered forward flight crosses toward the viewer and exits screen-right; a turbine aircraft approaches behind it; the Aviation Aligned logo is then revealed and docks into the engineering target before the value proposition appears.

## Motion reference

The supplied helicopter recording is the visual reference for flight attitude and rotor behaviour—not content to publish. Its key cues are:

- the nose leads the movement and the tail trails;
- the underside, skids and forward three-quarter airframe are visible;
- the body has a small bank/pitch change as it crosses the camera;
- the rotor is a shallow perspective-compressed disk, not a flat circle;
- individual photographic blades change phase continuously, while shutter persistence creates translucent blade trails;
- the complete aircraft translates, grows and banks as one object.

## Sequence

1. Opening: the H145 is already visible, high and near centre, large enough to feel close.
2. Forward flight: scrolling drives the airframe toward screen-right, slightly down and closer to camera. The nose points along the path.
3. Aircraft hand-off: the H145 clears; the turbine jet advances from depth just left of centre.
4. Brand reveal: the logo appears only after the aircraft have cleared.
5. Docking: the logo preserves its native 700:585 aspect ratio and finishes concentrically within the target circle.
6. Message: “Control the requirement. Prove the result.” appears after the logo has settled.

## Technical approach

- Render the H145 body and five-blade photographic rotor into one canvas each frame.
- Use a rotorless, transparent H145 body captured in forward-flight attitude.
- Flip the source airframe so its nose faces screen-right, matching its travel direction.
- Rotate actual blade imagery through a compressed perspective transform with multiple low-alpha shutter samples.
- Stop continuous rotation for `prefers-reduced-motion`, but keep the helicopter visible so accessibility settings never produce an empty hero.
- Use one shared set of target coordinates for the circle and logo; scale the logo uniformly only.

## Acceptance criteria

- H145 is visibly present on first load in a clean browser.
- Helicopter nose faces the direction of travel.
- Rotor blades visibly change phase between frames and remain mechanically centred on the mast.
- No CSS circles, icon blades or unrelated spinner graphics are used as the rotor.
- No parked/level product-shot impression; airframe reads as banked forward flight.
- Jet is turbine-powered and approaches toward camera.
- Logo never stretches and ends exactly centred inside the target circle.
- Desktop and mobile layouts remain legible.
- Reduced-motion mode still displays a helicopter.
- Production build passes and a clean browser produces no console errors.
