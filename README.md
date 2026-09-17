# Atari engine

A standalone, dependency-free JavaScript engine for games using the approved Atari visual vocabulary. Version 0.1 extracted the working graphics layer and common browser runtime from Impossible Cartridge. Version 0.2 adds TIA sound, the full 128-colour palette, per-scanline background colour and a hardware-shaped object budget.

## Run independently

From this folder:

```sh
npm test
npm start
```

Open http://127.0.0.1:8043/ for the Arena and Room examples, and `/examples/sound.html` for the tone lab. No install or build step is required. `PORT` changes the local server port. This directory can be copied elsewhere without any game project; it contains no imports from Cargo. Node 20 or later is needed for the example server and tests. The engine itself runs as browser ES modules.

## Ownership

| Engine | Cartridge |
| --- | --- |
| Palette framebuffer, drawing primitives and the artwork format | Maps and sprite artwork |
| Display scaling and pixel-exact collision detection | Movement and collision rules |
| Keyboard input, console switches, plus programmatic touch input | Meaning of the action button and of each game variation |
| Fixed-step timing and pause on blur | Entities, objectives, scoring and persistence |
| TIA sound primitives and the object budget | Game-specific sound effects and music |

Reference artwork belongs in `examples`, not `src`. The engine has no cargo, worker, enemy, towing, inventory or delivery concepts. It detects
that two objects overlapped, because the TIA does that in hardware, but it has no opinion
about what an overlap means.

## Public API

Import from `src/index.mjs`:

- `VCSFrame`, `WIDTH`, `HEIGHT`, `PALETTE`: indexed graphics. `clear`, `background`, `scanlines`, `playfield`, `sprite`, `missile`, and `number` draw the image. `rgba` supports exports and headless tests. `present` displays static frames.
- `pixels(art)`, `pixelText(rows)`: sprite artwork as something a person can read. Eight
  columns wide, one line per row, `.` for an empty pixel and any other visible character for
  a set one; indentation and surrounding blank lines are ignored, so a deliberately empty row
  is written out in full. Malformed art names the row and shows the line. `pixelText` is the
  inverse, for reading a sprite back in a test failure. `playfield` accepts the same `./#`
  notation alongside raw 0s and 1s. Hand-written hex hides mistakes — nobody spots a changed
  antenna in `0x24` during review, but everyone spots it in the picture. The artwork is still
  the cartridge's; this is only the format.
- `frame.scanlines(y, height, colorFor)`: one background colour per scanline, the way a game rewrites COLUBK down the frame. `colorFor(line, offset)` returns a colour, or `null` to leave that line alone. This is where banded skies and gradients come from.
- `sprite(rows, { copies, spacing, ... })`: NUSIZ. A player can be drawn as two or three
  copies at a spacing of 16, 32 or 64 colour clocks, or as one stretched object, but never
  both. There is no three-copies-at-64 register, so that combination is refused. Copies are
  one register: they share a bitmap, a colour and a reflection, and they move together.
  Those restrictions are the point — they are why a row of 2600 objects reads as a grid of
  identical things flapping in lockstep rather than as a composition.
- `frame.collisions()`, `frame.hit(a, b)`, `frame.hit(a)`: collision, latched while drawing
  and read afterwards, the way a cartridge reads the TIA's collision registers during
  vertical blank. Overlap is pixel-exact, not by bounding box, which is what makes objects
  feel tight around the concave parts of a sprite. Tag an object with `id` on `sprite`,
  `missile` or `playfield` to track it; untagged objects are invisible to collision and cost
  nothing. Draws sharing an id are one object, exactly as a reused register behaves, so a row
  of repeated enemies reports a single hit and the game works out which one from position.
  Overlap is recorded whatever the draw order, including where a later object paints over an
  earlier one. `clear()` releases the latch. The background is not an object and never
  collides. A frame tracks up to 32 ids; the hardware has six, so staying near that keeps a
  game honest.
- `TIA_BUDGET`, `UNLIMITED`: the per-scanline object budget, `{sprites: 2, missiles: 3}` by default, matching two players plus two missiles and a ball. Drawing past it throws and names the scanline. Copies cost one player however many they paint, so two registers legitimately fill a scanline with six objects. Reusing an object further down the screen is free too, which is how real games draw more than two things. Pass `new VCSFrame(PALETTE, {budget})` to raise it, use `UNLIMITED` to lift it, or `null` to switch the check off. A rejected draw leaves the frame untouched.
- `createDisplay(canvas)`: a reusable canvas presenter for animation. Call
  `display.present(frame)` each rendered frame. It reuses one image for the life of the
  display, so presenting allocates nothing; `frame.blit(data)` is the same path if you are
  presenting somewhere else. `rgba` still allocates and remains the export and test path.
- `createInput({ target, onCommand })`: arrows/WASD and Space. `read()` returns `{ x, y, action }`. `press(code)` and `release(code)` support touch adapters. P and R call `onCommand('pause' | 'reset')`. `clear()` releases held input; `destroy()` removes listeners. The default target is `document`; embedded games can supply their focused element.
- `createGamepad({ index, deadzone, buttons, axes, pads })`: a physical stick, polled on
  each `read()` because axes have no events. The digital reading matches the keyboard's, so
  a cartridge cannot tell them apart, and the d-pad wins whenever it speaks. `analog` carries
  the raw stick past the deadzone, which is the nearest thing to a paddle most people still
  own: integrate `analog.x` over time rather than treating it as an absolute position, since
  a stick springs back to centre and would otherwise snap the bat to the middle on release.
  `pads` names the source of connected pads, so this runs without a browser.
- `combineInputs(...sources)`: reads several controls as one. The first source with a
  direction wins and any of them can fire, so a keyboard and a stick are interchangeable.
- `createConsole({ target, keys, onSwitch })`: the machine's front panel, which is not the
  controller. `read()` returns `{ select, reset, color, difficulty: { left, right } }`.
  Select and Reset are momentary and latch a tap the way the action button does, so a press
  between two reads is never missed; held down they keep reading true, which is how a real
  console runs through variations, and a game wanting one step per press debounces it
  itself. Colour and the two difficulty switches are toggles that flip once per press rather
  than per key repeat. `set({ color, left, right })` flips them from a host's own interface,
  `press`/`release` drive it from a touch adapter, and `onSwitch(name, value)` reports every
  change. Defaults sit on `Digit1` to `Digit5`, one row of keys for one row of switches, and
  `keys` remaps them. Cycling numbered variations with Select is core 2600 UX: Combat ships
  27 of them and Space Invaders 112, so a faithful clone needs this.
- `SCORE_FONT`: ten digits as eight-pixel player graphics, which is what a score is made of
  on real hardware, so the strokes are thick rather than a thin grid. Pass `font` to `number`
  to replace it with any ten 8-bit glyphs.
- `greyscale(code)`: what the colour switch does to a colour, hue 0 at the same luminance.
  Map a palette through it and assign the result to `frame.palette` to render in black and
  white.
- `createLoop({ input, update, render, onPause, hz, maxElapsed })`: start with `loop.start()`. `update(input, dt)` advances cartridge state; `render()` draws it. The default is 60 simulation steps per second, with at most 50 ms of catchup. 60 Hz is deliberate: a cartridge runs its logic once per frame during vertical blank and moves objects whole pixels, and simulating faster reintroduces the sub-pixel motion that reads as modern rather than as a 2600. Supports `setPaused`, `togglePause`, `resetClock`, and `destroy`. Hiding the tab or blurring the window pauses it; resuming is explicit.
- `createClock`: browser-independent fixed-step accumulator used by the runtime and tests.
- `createVoices(sound, { channels })`: composes effects out of the sound primitives.
  `play(effect)` takes a channel and returns which, or null when a louder claim keeps it;
  `step()` advances every sounding channel by one frame and belongs in the game loop beside
  `update()`, because a cartridge writes its audio registers once a frame during vertical
  blank. An effect is a list of per-frame writes, or `{ control, frames, at(frame), loop,
  priority }` — sweeps and decays read better as a function, short fixed blips as a list.
  Priority stops a footstep cutting off an explosion when both channels are busy. The effects
  themselves stay with the cartridge; `examples/sound.html` has four to read.

The cartridge initializes its own state before starting the loop. No inheritance, entity hierarchy or global engine singleton is required. Dispose both input and loop when unmounting a cartridge. With the default input target, run one active cartridge per document.

## Visual contract

The logical frame is 160 × 192. Playfield cells occupy four horizontal clocks; 20-bit fields mirror or repeat, while 40-bit fields can be asymmetric. Sprites use eight-bit rows and either 1×, 2× or 4× horizontal stretch or two to three repeated copies. Score digits are eight-bit players like any other object. The presenter expands pixels by 8 × 5 for a chosen 4:3 image.

The palette is the full NTSC grid: 16 hues by 8 luminances, addressed as the hardware does, with bit 0 ignored so only even codes exist. Hue 0 is the grey ladder and hues 1-15 step the colourburst by roughly 26.2 degrees, which is why `$Fx` lands just past `$1x`. Values were fitted to the 25 hand-picked colours 0.1 shipped with, all of which reproduce to within one step per channel, so compositions built against 0.1 are unchanged. Luminance rises monotonically within every hue, which is what makes shading ramps usable. It remains a replaceable approximation: analog colour varied with console, television and emulator.

This is a visual framework, not a cycle-accurate emulator. It enforces a per-scanline object budget but no register scheduling. There are no CRT effects or browser fonts in the framebuffer.

## Sound

Audio is the TIA circuit rather than an impression of it, because the circuit is small
enough that reproducing it is easier than approximating it. Two channels, a 4-bit
volume, a 5-bit frequency divider and a 4-bit waveform selector, built from real 4-bit,
5-bit and 9-bit polynomial counters. Every setting is verified against its documented
division ratio in `test/tia.test.mjs`: div 2, div 6, div 31 and div 93 for the pure
tones, and full 15, 31 and 511 step cycles for the polys.

- `createSound({ context, gain, lowPass, highPass })`: resolves an `AudioContext` and a
  worklet. `set(channel, { control, frequency, volume })` writes the three registers of
  one channel; games normally do this once a frame, during vertical blank, exactly as a
  cartridge would. `note`, `off`, `silence`, `read`, `resume` and `destroy` complete it.
  Browsers start the context suspended, so call `resume()` from a key or pointer event.
- `AUDC`: the twelve distinct waveform settings by name. Real hardware duplicates
  several of them, so only one name is given for each.
- `pitch(control, hz)`: the nearest playable AUDF for a wanted pitch, and how far off it
  lands. The divider is coarse enough that the console cannot play in tune — A440 on
  `bass` arrives at 436.1 Hz, 15 cents flat, and the pure `tone` setting cannot reach
  A440 at all. That detuning is the sound, so it is reported rather than corrected.
- `createTiaChip(sampleRate, options)`: the chip on its own, with `tick`, `level`,
  `render` and `reset`. It runs headless under Node, which is how the tests measure
  waveform periods directly. `src/sound.mjs` stringifies this one function to build the
  worklet, so there is a single implementation and still no build step.

The divide-by-31 pattern in `src/tia.mjs` is the one constant transcribed from
documentation rather than derived; its period is verified, but the exact run structure
decides which harmonic dominates and is worth checking against a reference recording.

Next: a small paddle cartridge to exercise input, graphics and audio together without
sharing Cargo's physics,. New abstractions should be earned by actual
examples. No package publishing, editor or asset pipeline is planned yet.

## Working with Impossible Cartridge

The game project has one local symlink, `prototype/atari-engine`, to this project. Its existing graphics module is now a compatibility re-export. Cargo imports this engine, while its state and towing code stay in `prototype/graphics`. The existing local game URLs continue to work. If either project moves, update that link or serve a copied/versioned engine folder under the same path.

This is a standalone package directory within the current workspace. It has not been published or initialized as a separate Git repository.

## References

- [Stella Programmer's Guide, Steve Wright, archived transcription](https://alienbill.com/2600/101/docs/stella.html)
- [Combat screenshots](https://www.atariage.com/screenshot_page.php?SoftwareLabelID=94)
- [Adventure screenshots](https://www.atariage.com/screenshot_page.php?SoftwareLabelID=1)

See the examples for original interpretations of those reference compositions.
