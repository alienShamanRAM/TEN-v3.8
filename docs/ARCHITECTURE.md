# TEN VFram Architecture

TEN VFram starts as a safe migration from the current TEN26 app. The visual baseline stays intact while new modules are planned carefully before they take over runtime work.

## Main Rule

Heavy work happens when data changes. The frame loop should only read prepared data, move dots, and draw.

## Current Migration Shape

- `ten26-state.js`, `ten26-engine.js`, `ten26-presets.js`, and `ten26-ui.js` are the preserved visual baseline.
- `src/` is reserved for future modules.
- No ES-module bridge currently runs in the page. This keeps the new version close to the previous app while we isolate the real lag sources.

## Target Structure

```text
src/app
  AppController       starts modules and owns app lifecycle
  FrameLoop          runs requestAnimationFrame only
  SceneStore         stores current app state

src/slides
  SlideManager       owns slides and SVG channels
  SvgGeometry        extracts fill/path/anchor/mask data
  SvgTargetCache     prepares reusable target points
  SvgMaskCache       prepares mask lookup data

src/grid
  GridModel          creates center-anchored grid coordinates

src/data
  FieldComposer      combines grid, SVG, blink, flicker, mouse, audio, video

src/dots
  DotWorld           owns dot position, velocity, ids, and homes
  DotPhysics         moves dots from one composed field
  DotStyleEngine     decides color, size, alpha
  DotRenderer        draws dots only

src/effects
  FlickerEngine      creates transition phase and flicker data
  BlinkEngine        creates dot visibility data

src/visuals
  StageLayout        owns stage size, center anchoring, and layer placement
  Background         owns color/image background

src/presets
  PresetManager      import/export/save/load
```

## Center-Anchored Coordinates

The new stage model treats the center as the stable origin.

```js
screenX = stageWidth / 2 + worldX;
screenY = stageHeight / 2 + worldY;
```

Changing width or height reveals more or less stage area. It should not rescale or shift the artwork relative to center.

## SVG Slides

The current runtime keeps the previous single-SVG slideshow behavior. This avoids adding channel composition work while the priority is smooth playback.

## Next Refactor Step

Move dot physics out of `ten26-engine.js` into `src/dots/DotWorld.js` and `src/dots/DotPhysics.js`, then make the old engine call those modules through a small adapter. Do not change UI behavior during that step.
