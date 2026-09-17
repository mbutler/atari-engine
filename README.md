# Atari engine

A standalone, dependency-free JavaScript engine for games using the approved Atari visual vocabulary. Version 0.1 extracts the working graphics layer and common browser runtime from Impossible Cartridge.

## Run independently

From this folder:

```sh
npm test
npm start
```

Open http://127.0.0.1:8043/ for the Arena and Room examples. No install or build step is required. `PORT` changes the local server port. This directory can be copied elsewhere without any game project; it contains no imports from Cargo. Node 20 or later is needed for the example server and tests. The engine itself runs as browser ES modules.

## Ownership

| Engine | Cartridge |
| --- | --- |
| Palette framebuffer and drawing primitives | Maps and sprite artwork |
| Display scaling | Movement and collision rules |
| Keyboard input, plus programmatic touch input | Meaning of the action button |
| Fixed-step timing and pause on blur | Entities, objectives, scoring and persistence |
| Future sound primitives | Game-specific sound effects and music |

Reference artwork belongs in `examples`, not `src`. The engine has no cargo, worker, enemy, towing, inventory or delivery concepts. Collision helpers are not part of its default runtime.

## Public API

Import from `src/index.mjs`:

- `VCSFrame`, `WIDTH`, `HEIGHT`, `PALETTE`: indexed graphics. `clear`, `background`, `playfield`, `sprite`, `missile`, and `number` draw the image. `rgba` supports exports and headless tests. `present` displays static frames.
- `createDisplay(canvas)`: a reusable canvas presenter for animation. Call `display.present(frame)` each rendered frame.
- `createInput({ target, onCommand })`: arrows/WASD and Space. `read()` returns `{ x, y, action }`. `press(code)` and `release(code)` support touch adapters. P and R call `onCommand('pause' | 'reset')`. `clear()` releases held input; `destroy()` removes listeners. The default target is `document`; embedded games can supply their focused element.
- `createLoop({ input, update, render, onPause, hz, maxElapsed })`: start with `loop.start()`. `update(input, dt)` advances cartridge state; `render()` draws it. The default is 120 simulation steps per second, with at most 50 ms of catchup. Supports `setPaused`, `togglePause`, `resetClock`, and `destroy`. Hiding the tab or blurring the window pauses it; resuming is explicit.
- `createClock`: browser-independent fixed-step accumulator used by the runtime and tests.

The cartridge initializes its own state before starting the loop. No inheritance, entity hierarchy or global engine singleton is required. Dispose both input and loop when unmounting a cartridge. With the default input target, run one active cartridge per document.

## Visual contract

The logical frame is 160 × 192. Playfield cells occupy four horizontal clocks; 20-bit fields mirror or repeat, while 40-bit fields can be asymmetric. Sprites use eight-bit rows and 1×, 2× or 4× horizontal stretch. Bitmap numbers use the same indexed raster. The presenter expands pixels by 8 × 5 for a chosen 4:3 image.

The palette remains a replaceable NTSC-style RGB approximation. This is a visual framework, not a cycle-accurate emulator. It does not validate hardware object limits or register scheduling. There are no CRT effects or browser fonts in the framebuffer.

## Sound roadmap

Authentic audio is the next engine milestone, not implemented in 0.1. First study reference sounds and the TIA audio behavior, then build isolated tone/noise examples and check pitch, timing, volume and channel interactions. Game effects should be composed from those primitives. Any expanded channel or speech capability should be an explicit extension rather than an accidental default.

After sound, a small paddle cartridge should exercise input, graphics and audio without sharing Cargo's physics. New abstractions should be earned by actual examples. No package publishing, editor or asset pipeline is planned yet.

## Working with Impossible Cartridge

The game project has one local symlink, `prototype/atari-engine`, to this project. Its existing graphics module is now a compatibility re-export. Cargo imports this engine, while its state and towing code stay in `prototype/graphics`. The existing local game URLs continue to work. If either project moves, update that link or serve a copied/versioned engine folder under the same path.

This is a standalone package directory within the current workspace. It has not been published or initialized as a separate Git repository.

## References

- [Stella Programmer's Guide, Steve Wright, archived transcription](https://alienbill.com/2600/101/docs/stella.html)
- [Combat screenshots](https://www.atariage.com/screenshot_page.php?SoftwareLabelID=94)
- [Adventure screenshots](https://www.atariage.com/screenshot_page.php?SoftwareLabelID=1)

See the examples for original interpretations of those reference compositions.
