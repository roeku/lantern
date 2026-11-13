import { describe, expect, it } from 'vitest';
import { LEVEL, LEVEL_ROWS, TUNING } from '../../src/sim';
import { cellCenter, findPath, isWallCell } from '../../src/sim/grid';

describe('level', () => {
  it('has rectangular rows', () => {
    const w = LEVEL_ROWS[0]?.length ?? 0;
    for (const row of LEVEL_ROWS) expect(row.length).toBe(w);
  });

  it('has five chambers, three tapes, five gates, a VCR and an exit', () => {
    expect(LEVEL.chambers).toHaveLength(5);
    expect(LEVEL.tapes).toHaveLength(3);
    expect(LEVEL.gates.map((g) => g.group)).toEqual(['p', 'q', 'r', 'u', 'w']);
    expect(isWallCell(LEVEL.grid, LEVEL.vcr.cx, LEVEL.vcr.cy)).toBe(true);
    expect(isWallCell(LEVEL.grid, LEVEL.exit.cx, LEVEL.exit.cy)).toBe(true);
  });

  it('chambers tile the map and every chamber but the last has exactly one way out, a gate in its east wall', () => {
    expect(LEVEL.chambers[0]?.xMin).toBe(0);
    LEVEL.chambers.forEach((c, i) => {
      const next = LEVEL.chambers[i + 1];
      if (!next) return;
      expect(next.xMin).toBe(c.xMax + 1);
      const exits = LEVEL.gates.filter((g) => g.cell.cx === c.xMax);
      expect(exits, `chamber ${i + 1}`).toHaveLength(1);
      // The wall has no other hole
      const holes = Array.from({ length: LEVEL.grid.height }, (_, cy) => cy).filter((cy) => !isWallCell(LEVEL.grid, c.xMax, cy));
      expect(holes).toEqual([exits[0]?.cell.cy]);
    });
  });

  it('each entry sits just past the previous chamber\'s gate, and each tape sits on an entry', () => {
    LEVEL.chambers.slice(1).forEach((c, k) => {
      const gate = LEVEL.gates.find((g) => g.cell.cx === LEVEL.chambers[k]?.xMax);
      expect(c.entry).toEqual({ cx: c.xMin, cy: gate?.cell.cy });
      expect(LEVEL.checkpoints[k + 1]).toEqual(cellCenter(c.entry));
    });
    for (const t of LEVEL.tapes) expect(LEVEL.chambers.some((c) => c.entry.cx === t.cx && c.entry.cy === t.cy)).toBe(true);
  });

  it('every hiding spot opens onto an aisle and is walled on the other sides', () => {
    for (const h of LEVEL.hides) {
      const open = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => !isWallCell(LEVEL.grid, h.cx + (dx ?? 0), h.cy + (dy ?? 0)));
      expect(open.length, `${h.cx},${h.cy}`).toBe(1);
    }
  });

  it('every plate, tape and hide is reachable from its chamber entry once the gates are open', () => {
    LEVEL.chambers.forEach((ch, i) => {
      const entry = LEVEL.checkpoints[i];
      if (!entry) throw new Error('entry');
      const from = { cx: Math.floor(entry.x), cy: Math.floor(entry.y) };
      const goals = [
        ...LEVEL.plates.map((p) => p.cell),
        ...LEVEL.hides,
        ...LEVEL.gates.map((g) => g.cell),
      ].filter((c) => c.cx >= ch.xMin && c.cx <= ch.xMax);
      for (const g of goals) expect(findPath(LEVEL.grid, from, g).length, `chamber ${i + 1} ${g.cx},${g.cy}`).toBeGreaterThan(0);
    });
  });

  it('a lone player cannot beat a gate: its plate is too far to sprint, or sits behind another gate', () => {
    // Single-plate gates only. Two-plate gates need two bodies by definition.
    for (const gate of LEVEL.gates) {
      const mine = LEVEL.plates.filter((p) => p.group === gate.group);
      if (mine.length !== 1) continue;
      const plate = mine[0];
      if (!plate) continue;
      // A plate you cannot reach from your chamber's entry while every gate is shut is guarded by a gate already
      const chamber = LEVEL.chambers.find((c) => plate.cell.cx >= c.xMin && plate.cell.cx <= c.xMax);
      if (chamber) {
        const shut = { ...LEVEL.grid, walls: LEVEL.grid.walls.map((w, i) => w || LEVEL.gates.some((g) => g.cell.cy * LEVEL.grid.width + g.cell.cx === i)) };
        if (findPath(shut, chamber.entry, plate.cell).length === 0) continue;
      }
      const route = findPath(LEVEL.grid, plate.cell, gate.cell);
      const sprintSec = (route.length - 1) / TUNING.sprintSpeedMps;
      expect(sprintSec, `gate ${gate.group}`).toBeGreaterThan(gate.delaySec + 0.8);
    }
  });

  it('chamber 1 shows the lesson: from the start you face the plate and the gate, in one straight aisle', () => {
    const start = LEVEL.checkpoints[0];
    const plate = LEVEL.plates.find((p) => p.group === 'p');
    const gate = LEVEL.gates.find((g) => g.group === 'p');
    if (!start || !plate || !gate) throw new Error('chamber 1');
    expect(Math.floor(start.y)).toBe(plate.cell.cy);
    expect(plate.cell.cy).toBe(gate.cell.cy);
    expect(plate.cell.cx).toBeGreaterThan(start.x);
    for (let cx = Math.floor(start.x); cx < gate.cell.cx; cx++) expect(isWallCell(LEVEL.grid, cx, gate.cell.cy)).toBe(false);
    // Facing +x
    expect(-Math.sin(LEVEL.startYawRad)).toBeCloseTo(1, 9);
  });

  it('a Thing lives only in chamber 3 and the VCR room, with spawns on floor inside them', () => {
    expect(LEVEL.chambers.map((c) => c.thingSpawns.length > 0)).toEqual([false, false, true, false, true]);
    for (const ch of LEVEL.chambers.filter((c) => c.thingSpawns.length > 0)) {
      for (const c of ch.thingSpawns) {
        expect(isWallCell(LEVEL.grid, c.cx, c.cy)).toBe(false);
        expect(c.cx >= ch.xMin && c.cx <= ch.xMax).toBe(true);
      }
    }
  });
});
