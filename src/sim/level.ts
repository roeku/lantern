import { cellCenter, parseGrid } from './grid';
import type { Cell, Grid } from './grid';
import type { Vec2 } from './vec2';

/**
 * The rental shop, as four chambers in a row. Each chamber asks one question about the tape.
 *  '#' shelf or wall   '.' floor   'D' door (starts closed)   'H' hiding spot (alcove)
 *  'C' counter (solid)  'V' VCR on the counter (solid)  'X' exit door (solid until the tape has played)
 *  '1' '2' '3' tapes   'S' player start
 *  'p' 'q' 'r' 'u' 'w' pressure plates   'P' 'Q' 'R' 'U' 'W' gates. A gate is open while every plate of its letter is held.
 * Doors, gates, tapes and the exit are state, not terrain: the base grid only holds shelves, the counter and the exit.
 *
 * Chamber 1 (x 0..11):  start, plate and gate on one line, all in view. Walking in steps on the plate and opens the gate;
 *                       it shuts before you get there. Record yourself on the plate and your echo holds it.
 * Chamber 2 (x 12..22): two plates, one for you and one for your echo.
 * Chamber 3 (x 23..33): the Thing patrols the ring. Sprint in your clip and your echo draws it away.
 * Chamber 4 (x 34..44): two gates, two plates, one job each. Your echo holds the far plate, which opens the inner gate.
 *                       You go in and stand on the plate in there, which opens the way out. No Thing: a breather.
 * Chamber 5 (x 45..55): the VCR room. Record from an alcove, walk to the VCR and hold E; rewound, you are back in the
 *                       alcove, hidden, while your tape-self plays the tape and the Thing goes for it.
 */
export const LEVEL_ROWS: readonly string[] = [
  '########################################################',
  '############..........#..........#..........#..........#',
  '############.q........Q2.........R..........#..........#',
  '############..........#..........#..........#..........#',
  '############........q.#...##H##..#..........#..###.###.#',
  '############...####...#...#####..#..........#..###.###.#',
  '############...####...#...#####..#.....##U###..#H#.#H#.#',
  '#..........#...####...#...#####..#.....#....#..........#',
  '#..........#...####...#...##H##..#.....#....#..........#',
  '#..........#..........#..........#.....#....#..........#',
  '#S..p......P1.........#.r........#.....#..w.W3.CCVCC...#',
  '#..........#..........#..........#u....#....#..........#',
  '#####################################################X##',
];

export interface PlateDef {
  cell: Cell;
  /** Lowercase letter shared with its gates. */
  group: string;
}

export interface GateDef {
  cell: Cell;
  group: string;
  /** How long it stays open after its plates let go. */
  delaySec: number;
}

export interface ChamberDef {
  /** The chamber owns every cell column from xMin to xMax inclusive. A gate in the right wall belongs to the chamber on its left. */
  xMin: number;
  xMax: number;
  /** Where you wake after a catch here, and where a tape waits if the chamber has one. */
  entry: Cell;
  /** 1 Closing, 2 Rain, 3 Blackout. */
  act: number;
  /** No Thing hunts here, but it follows your route unseen (see shadow.ts). */
  shadow: boolean;
  /** Where its Thing may start. Empty means no Thing lives here. */
  thingSpawns: readonly Cell[];
  /** Cells the Thing may patrol to: floor in this chamber, minus hiding spots. */
  patrolCells: readonly Cell[];
}

/**
 * Close delay per gate letter. The first gate snaps shut so the lesson lands in plain view: you see it open, you see it
 * shut before you get there. The rest give you time to step off a plate and through.
 */
const GATE_DELAY_SEC: Readonly<Record<string, number>> = { p: 0.4, q: 3.5, r: 2, u: 2, w: 2 };

/** Spans, entries, acts and Thing spawns. Chambers 1, 2 and 4 are empty on purpose: the tape is learned in safety. */
const CHAMBER_SPANS: ReadonlyArray<Omit<ChamberDef, 'patrolCells'>> = [
  { xMin: 0, xMax: 11, entry: { cx: 1, cy: 10 }, act: 1, shadow: true, thingSpawns: [] },
  { xMin: 12, xMax: 22, entry: { cx: 12, cy: 10 }, act: 1, shadow: true, thingSpawns: [] },
  {
    xMin: 23,
    xMax: 33,
    entry: { cx: 23, cy: 2 },
    act: 2,
    shadow: false,
    thingSpawns: [
      { cx: 31, cy: 10 },
      { cx: 32, cy: 6 },
      { cx: 30, cy: 2 },
    ],
  },
  { xMin: 34, xMax: 44, entry: { cx: 34, cy: 2 }, act: 2, shadow: true, thingSpawns: [] },
  {
    xMin: 45,
    xMax: 55,
    entry: { cx: 45, cy: 10 },
    act: 3,
    shadow: false,
    // The north side, as far from the counter as the room allows: it takes a while to hear the tape
    thingSpawns: [
      { cx: 54, cy: 2 },
      { cx: 46, cy: 2 },
      { cx: 50, cy: 2 },
    ],
  },
];

export interface Level {
  /** Shelves, walls, the counter and the exit. Doors and gates are floor here. */
  grid: Grid;
  doors: readonly Cell[];
  hides: readonly Cell[];
  vcr: Cell;
  /** Counter cells, VCR included. Solid. */
  counter: readonly Cell[];
  exit: Cell;
  tapes: readonly Cell[];
  plates: readonly PlateDef[];
  gates: readonly GateDef[];
  chambers: readonly ChamberDef[];
  /** Index n is where you wake in chamber n: its entry. Index 0 is the start. */
  checkpoints: readonly Vec2[];
  /** The way you face at the start: down chamber 1 toward the plate and the gate. Same convention as `PlayerState.yawRad`. */
  startYawRad: number;
}

function findAll(rows: readonly string[], ch: string): Cell[] {
  const out: Cell[] = [];
  rows.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) if (row[cx] === ch) out.push({ cx, cy });
  });
  return out;
}

function one(rows: readonly string[], ch: string): Cell {
  const c = findAll(rows, ch)[0];
  if (!c) throw new Error(`level is missing '${ch}'`);
  return c;
}

export function buildLevel(rows: readonly string[]): Level {
  const solid = rows.map((r) => r.replace(/[VXC]/g, '#').replace(/[DH123SpqruwPQRUW]/g, '.'));
  const tapes = [one(rows, '1'), one(rows, '2'), one(rows, '3')];
    const grid = parseGrid(solid);
  const hides = findAll(rows, 'H');
  const plates: PlateDef[] = ['p', 'q', 'r', 'u', 'w'].flatMap((g) => findAll(rows, g).map((cell) => ({ cell, group: g })));
  const gates: GateDef[] = ['P', 'Q', 'R', 'U', 'W'].flatMap((g) =>
    findAll(rows, g).map((cell) => ({ cell, group: g.toLowerCase(), delaySec: GATE_DELAY_SEC[g.toLowerCase()] ?? 2 })),
  );
  const chambers: ChamberDef[] = CHAMBER_SPANS.map((span) => ({
    ...span,
    patrolCells: grid.floorCells.filter(
      (c) => c.cx >= span.xMin && c.cx <= span.xMax && !hides.some((h) => h.cx === c.cx && h.cy === c.cy),
    ),
  }));
  return {
    grid,
    doors: findAll(rows, 'D'),
    hides,
    vcr: one(rows, 'V'),
    counter: [...findAll(rows, 'C'), ...findAll(rows, 'V')],
    exit: one(rows, 'X'),
    tapes,
    plates,
    gates,
    chambers,
    checkpoints: [cellCenter(one(rows, 'S')), ...chambers.slice(1).map((c) => cellCenter(c.entry))],
    // Facing +x: forward is (-sin yaw, -cos yaw)
    startYawRad: -Math.PI / 2,
  };
}

export const LEVEL: Level = buildLevel(LEVEL_ROWS);
export const LEVEL_GRID: Grid = LEVEL.grid;
