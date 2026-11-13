---
inclusion: fileMatch
fileMatchPattern: "src/client/**"
---

# Feel rules

The client only reads sim state and produces inputs. Feel is presentation, never rules.

## Feeling
"I have to look, and looking is what gets me caught." Every client decision should serve that. Quiet dread with a dry wit, not a jump-scare corridor.

## Look
Palette: near-black, fluorescent green-white, REC red (the accent), tape-blue. Nothing outside it.
- Lens down: clean, dim, readable world. No post-process.
- Lens up: VHS post-process (grain, tracking bands, chroma bleed) on the lens view only. The contrast is what says "this is the tape".
- Materials: plastic, magnetic tape, lino, rain, fluorescent tube, CRT glass.

## Weighted events (each needs layered feedback; do not ship one with fewer layers)
- Thing notices you (biggest tell): hiss rises, tracking tear, REC beep stutters, vignette tightens, a half-second of silence.
- Rush: screech, sub drone, FOV kick, camera trauma shake, lights flicker, everything else ducks.
- Caught and rewind: tape-stop pitch drop, scrub bands, under 0.5 s back in play, cause shown for the first frames.
- Tape found, or a chamber cleared: cassette clack, a chime that climbs one step of the B pentatonic per chamber, screen flash, banner (and the battery tops up on a tape).
- Win card (the aftermath): silence, then a top-down map of the night drawn in stages (your route, your tape-selves, the Thing's path in red, "IT WAS HERE"), then a row per chamber counting in with a tick each, then totals counting up. The still is the share card until the TV replay exists.
- Blackout: hum dies, rain swells, emergency light snaps on.
- Replay reveal: silence, TV static, timecode, the Thing appears in old frames.
Minor events get one or two layers only.

## Sound
- Web Audio synthesis only. Each sound has a transient, a body and a tail. No bare single-oscillator beeps.
- One key: the 60 Hz mains hum (about B1). Do not add a second key.
- Palette: door creak, door bang (positional, so you can hear where it is pushing), cassette clack, VCR motor, exit bolt, transformer thunk, fluorescent buzz, rain on glass, tape hiss (louder as the Thing nears), servo whirr, REC beep, lino footsteps, VCR rewind chirp, Thing idle and rush screech, tape-stop, TV static.
- Repeated sounds vary in pitch by +/- 5 to 10 percent. One shared reverb. Buses and a limiter. Unlock audio on the game's own first input.
- Do not add sounds outside this list without updating this file.

## UI
- Diegetic or in-world: viewfinder timecode, battery bar, REC light. Embedded font only, never a system font.
- Every number and bar reacts to change. States (title, death, end) are scenes with motion and sound, not centred boxes.
- No browser defaults: native buttons, alerts, default cursor, focus rings, text selection, scrollbars.
- Restart is one input.

## Camera
- Look is applied at render rate. Walk bob is small. Shake uses a trauma model on the world only, never the HUD, and is reserved for rush and catch.

## Input
- Keyboard and mouse with pointer lock, at a desk with headphones. The input that starts or restarts the game does nothing else on that frame.
