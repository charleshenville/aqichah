# Manifolds

Confluences of swept splines (blades, ribbons, tubes) in chrome, glass or flat
colour, with an edge-detection post effect (Lines & fill). `/vfx/manifolds`.

```
params.js       every parameter, in the compositor's definition format; the panel is drawn from it
looks.js        built-in looks
presets.js      download / open preset files
controls.js     the panel's controls; ParamGroup draws a group from its definitions
Manifolds.js    the tool: panel, transport, point-editor wiring, undo, export
model/          plain functions, no three, no React (node-testable)
  random.js       seeded rng, value noise, vector helpers
  curves.js       Catmull-Rom (tension = alpha), Bézier chains, B-spline, linear;
                  arc-length sampling with rotation-minimising frames over the whole curve
  generate.js     the five forms; each strand random from (seed, index) only
  strands.js      rest (generated + edits, then hand-drawn), posed (wobble at t), windows (trim/stagger/slide)
  edits.js        moving points, resetting, hand-drawn strands, bake: patches to params
engine/         three.js, no React
  geometry.js     strands swept into one mesh, buffers rewritten in place
  materials.js    MeshPhysicalMaterial with cellular holes; the G-buffer material (normals, depth, coverage)
  environment.js  reflection maps (studio, sky, bands, room, image) via PMREM, on the material
  ManifoldObject.js  the object: { object, sync(p, t), setPass, dispose }, adapter-shaped
  EdgeFx.js       Lines & fill: silhouettes / depth / folds / luma edges, flat / ink / tone fills
  Stage.js        the tool's renderer: colour + G-buffer (MSAA) → display → EdgeFx → overlay
  PointEditor.js  markers, control cages, picking and the move gizmo
  exporter.js     PNG and offline MP4 (lib/mp4Writer)
```

Rules (the compositor's):

- Every parameter is one flat key with a plain value, so a controller link
  can drive any of them. Integers that rebuild (`count`, `anchors`, `seed`,
  `samples`, `radial`, `bundle`, `profile`) are marked `rebuilds`.
- A frame is a pure function of (params, t): motion turns a whole number of
  cycles per `loop`, so preview and export agree and loops are seamless.
- Defining points are data beside the parameters, as a Spline's `points` are:
  `edits` ({strand: {point: [dx,dy,dz]}}, on top of the generator),
  `hand` (hand-drawn strands) and `strandLook` (hidden / width). They are
  replaced, never mutated.

## In the compositor

- **Object.** The Manifold type (compositor/model/schema.js) is
  `COMPOSITOR_OBJECT_GROUPS` + `OBJECT_LINE_GROUPS` + the compositor's layer,
  spin and transform; its adapter is compositor/engine/manifoldAdapter.js.
  The sound-driven spline that used to be called `manifold` is `soundSpline`
  (projects before v2 are migrated on open).
- **Reflections.** `reflect`: its own sky, or the scene: a cube map captured
  from its middle every frame (the scan's unlit copy on ENV_LAYER and the 3D
  in front, itself left out), over its sky.
- **Lines.** On the object alone (`linesOn`): a G-buffer where only it has
  coverage (the rest of the 3D only hides it), EdgeFx over the frame, held
  out where a matte stands in front. Over everything: the Lines effect
  (`EFFECT_LINE_GROUPS`), on the program or a track; `edgeSource` '3d' adds
  the 3D's outlines and folds where the picture is the 3D scene's.
- **Points.** Through the engine's corner handles: the picked strand's points
  where they are drawn; a move is converted to rest (so the wobble carries on)
  and written with `setPoint`. A click on the manifold while editing picks a
  strand. A Manifolds preset loads onto the object (`presetToObjectParams`).
- Not yet: point coordinates as expressions (`restStrands`' `coord`), and an
  image to reflect (the tool's `env: 'image'`).
