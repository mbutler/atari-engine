# Writing a cartridge

The engine holds the picture, the sound, the timing and the controls to 1982. It cannot
hold the *game* to 1982, and that is where the feeling actually comes from. A cartridge
built without these constraints will be a modern game wearing 2600 graphics, which reads
as a pastiche rather than as the thing itself.

`examples/cartridge.mjs` is a working reference. It is a dull game on purpose: copy its
shape, not its design.

## The audit

Every cartridge should pass all of these. They are not preferences.

- **Two players, three missiles, one playfield per scanline.** The engine throws if you
  exceed it. Reusing an object further down the screen is free; repeated copies of one
  player cost nothing extra. If a screen cannot be composed inside this, the design is
  wrong — and you find that out on day one rather than in month three.
- **128 bytes of state, and the stack shares them.** Aim for under 100.
- **One verb.** Fly, jump, catch, steer, shoot. Not two.
- **One screen, or a small family of them.** No levels.
- **Variations, not stages.** See below.
- **Whole-pixel motion.** See below.
- **A session is a few minutes.** Score is the only progression.
- **Nothing is explained.** No tutorial, no prompts, no narrative.

## Compose the screen first

The original development loop was kernel-first: what the hardware could draw per scanline
decided what the game could be, and everything else was fitted around it.

Do the same. Build the screen as a static frame — exactly as `examples/scenes.mjs` does —
before writing a single rule. It is the cheapest possible way to discover that a design
does not fit.

## State

Keep it in one `Uint8Array(128)`, taken as an argument rather than created internally:

```js
export function myGame({ram = new Uint8Array(128)} = {}) { ... }
```

Two reasons. It makes the budget real instead of aspirational — a byte you want has to
come from somewhere, which is exactly the pressure that shaped every game of the era. And
on real hardware that RAM lived in the console rather than the cartridge, so taking it as
an argument leaves the door open for a console to pass in state that survives a swap.

Name every byte in one table, as the reference does with `RAM`. If a byte is not on the
list, it does not exist.

Derive what you can instead of storing it. The reference computes falling speed from the
score, so a level counter costs nothing. Pitfall generated all 255 of its screens from a
single byte run through a shift register, because there was nowhere to put them.

## Motion

Whole pixels, always. A `Uint8Array` gives you this for free, which is half the reason to
use one.

Whole-pixel *speeds* are too coarse to tune — one pixel a frame is already twice as fast
as one every two — so carry the fraction in an accumulator and move when it overflows:

```js
ram[RAM.accum] += speed;            // speed in sixteenths of a pixel
while (ram[RAM.accum] >= 16) { ram[RAM.accum] -= 16; ram[RAM.y]++; }
```

A floating point position rounded at draw time is not the same thing. It advances a pixel
every 1.7 frames and produces an uneven shuffle that does not read as a 2600.

## Variations, not levels

Combat ships 27 game variations; Space Invaders 112. That is how 4K bought replay value:
the same kernel, re-parameterised. Faster, guided shots, invisible walls, one player or
two. Not new mechanics and not new screens.

Drive it from the Select switch and a single variation byte fanned out into flags. It is
the best content-per-byte in the medium, and almost nothing made today uses it.

The difficulty switches are free content too. A is the expert setting.

## Sound

Effects are the cartridge's, composed from the engine's primitives with `createVoices`.
Step it once per simulation frame, beside `update` — a cartridge writes its audio
registers during vertical blank, not on a timer of its own.

## Collision

Read it from the frame you just drew, at the top of the next `update`. That is when a
cartridge would read the TIA's collision registers.

Objects sharing an `id` are one object, exactly as a reused register is. A row of repeated
enemies reports a single hit and the game works out which one from position — that is not
a limitation to route around, it is how Space Invaders worked.

## What belongs where

The engine owns the console: picture, palette, sound chip, timing, controls, switches,
collision detection. The cartridge owns the game: artwork, movement, rules, entities,
scoring, what the button means, what an overlap means.

If you find yourself wanting an engine change, check first whether it is really a console
feature. Most things are not.

## What not to build

No level editor, no asset pipeline, no menu system, no save games, no hub, no boss, no
cutscenes. All of that is post-1985 vocabulary. The Select switch is the menu, the sprites
live in the source, and the manual explained the game.
