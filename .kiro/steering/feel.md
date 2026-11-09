---
inclusion: fileMatch
fileMatchPattern: "src/client/**"
---

# Feel rules

The client only reads sim state and produces inputs. Feel is made of presentation, never rules.

## Palette
Do:
- Near-black base, candle amber, cold blue-white beam, oxblood accent.
- Wax, smoke, painted glass, brass, stone materials.
- Lit 3D scenes in Three.js.

Don't:
- Add colours outside the palette.
- Use bright flat UI colours or pure white fills.
- Make it a jump-scare corridor. Tone is theatrical dread with comedy.

## Weighted events
Each needs layered feedback (visual, audio, camera, light, UI/haptic-style). Don't ship one with fewer layers.
- Candle snuffed: 6+ layers (for example wick hiss, light drop, smoke curl, camera kick, screen dim, audience sting).
- Ghost rush: cart rumble rises with speed, beam flare, shake, everyone hears it coming.
- Rope cut: creak then snap, rope whip, dust, a short hit-stop.
- Screen falls: crash, shockwave, dust, lights flicker.
- House lights up: sudden warm light on an ordinary room, silence, then the replay.

Don't spend this weight on minor events.

## Sound palette
Do:
- Glass armonica in one key only.
- Cart rumble (volume follows cart speed), wick hiss, coat swish, rope creak and snap, thunder sheet, bellows, convent bell, screen crash.

Don't:
- Add sounds outside this list without updating this file.
- Use a second musical key.

## UI
Do:
- Build all UI in-game with the palette: diegetic or styled HUD, custom cursor, custom menus and buttons.
- Show lobby and join-by-link in the same look.

Don't:
- Use browser-default controls: native buttons, inputs, selects, alert/confirm/prompt, default cursor, default focus rings without a styled replacement.
- Keep keyboard focus visible and operable when styling replaces defaults.

## Input
- Keyboard and mouse on a laptop. Friends are on a voice call, so no in-game voice or chat needed.
