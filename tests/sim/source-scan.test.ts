// Source scan: enforces determinism rules on src/sim.
// Validates: Requirements 1.5, 11.4, 12.6
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SIM_DIR = join(__dirname, '..', '..', 'src', 'sim');
const BOTS_DIR = join(__dirname, '..', '..', 'src', 'bots');
const CLIENT_DIR = join(__dirname, '..', '..', 'src', 'client');
const files = readdirSync(SIM_DIR).filter((f) => f.endsWith('.ts')).sort();

/** All .ts files under a directory, recursively. */
function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listTs(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Module specifiers from import/export-from/dynamic import/require (comments already stripped). */
function importTargets(src: string): string[] {
  const re = /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"`]([^'"`]+)['"`]/g;
  return [...src.matchAll(re)].map((m) => m[1] as string);
}

/**
 * Remove comments (and optionally string/template contents) while keeping
 * line structure. Quotes are kept so string positions stay visible.
 */
function strip(src: string, stripStrings: boolean): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') {
          if (!stripStrings) out += src[i];
          i++;
        }
        if (src[i] === '\n') out += '\n';
        else if (!stripStrings) out += src[i];
        i++;
      }
      out += c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const FORBIDDEN: Array<[string, RegExp]> = [
  ['Math.random', /\bMath\s*\.\s*random\b/],
  ['Date.now', /\bDate\s*\.\s*now\b/],
  ['performance.now', /\bperformance\s*\.\s*now\b/],
  ['setTimeout', /(?<![\w$.])setTimeout\b/],
  ['setInterval', /(?<![\w$.])setInterval\b/],
  ['window global', /(?<![\w$.])window\b/],
  ['document global', /(?<![\w$.])document\b/],
];

const IMPORT_THREE = /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"`]three(?:\/[^'"`]*)?['"`]/;

// Numeric literal not part of an identifier or member access (e.g. atan2, Math.PI).
const NUMBER = /(?<![\w$.])(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?n?)(?![\w$])/g;

/**
 * Exemption: rng.ts only. The mulberry32 algorithm constants are declared as
 * top-level `const NAME = <literal>;` lines (hex literals and small integers).
 * Only such lines in rng.ts are skipped; any other literal in rng.ts, and
 * every literal in every other file, is still checked.
 */
const RNG_CONST_DECL = /^const [A-Z][A-Z0-9_]* = (?:0[xX][0-9a-fA-F]+|\d+);\s*$/;

function isAllowedValue(text: string): boolean {
  const v = Number(text.replace(/_/g, ''));
  return v === 0 || v === 1;
}

function findLiterals(file: string, src: string): string[] {
  const found: string[] = [];
  strip(src, true)
    .split('\n')
    .forEach((line, idx) => {
      if (file === 'rng.ts' && RNG_CONST_DECL.test(line)) return;
      for (const m of line.matchAll(NUMBER)) {
        if (!isAllowedValue(m[1] as string)) found.push(`${file}:${idx + 1}: ${m[1]}`);
      }
    });
  return found;
}

describe('src/sim source scan', () => {
  it('finds sim source files', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('rng.ts');
  });

  it('contains no nondeterministic or DOM/Three.js references', () => {
    const violations: string[] = [];
    for (const f of files) {
      const raw = readFileSync(join(SIM_DIR, f), 'utf8');
      const code = strip(raw, true);
      for (const [label, re] of FORBIDDEN) {
        if (re.test(code)) violations.push(`${f}: ${label}`);
      }
      if (IMPORT_THREE.test(strip(raw, false))) violations.push(`${f}: three import`);
    }
    expect(violations).toEqual([]);
  });

  it('contains no numeric literals other than 0 and 1 outside tuning.ts', () => {
    const violations: string[] = [];
    for (const f of files) {
      if (f === 'tuning.ts') continue;
      violations.push(...findLiterals(f, readFileSync(join(SIM_DIR, f), 'utf8')));
    }
    expect(violations).toEqual([]);
  });

  it('src/bots has no clocks, Math.random or literals other than 0 and 1', () => {
    const botFiles = readdirSync(BOTS_DIR).filter((f) => f.endsWith('.ts'));
    expect(botFiles).toContain('spectator-bot.ts');
    const violations: string[] = [];
    for (const f of botFiles) {
      const raw = readFileSync(join(BOTS_DIR, f), 'utf8');
      const code = strip(raw, true);
      for (const [label, re] of FORBIDDEN) {
        if (re.test(code)) violations.push(`bots/${f}: ${label}`);
      }
      violations.push(...findLiterals(`bots/${f}`, raw));
    }
    expect(violations).toEqual([]);
  });

  it('src/sim imports nothing from client, net, server or bots', () => {
    const violations: string[] = [];
    for (const f of files) {
      const raw = strip(readFileSync(join(SIM_DIR, f), 'utf8'), false);
      for (const target of importTargets(raw)) {
        if (/(^|\/)(client|net|server|bots)(\/|$)/.test(target)) violations.push(`${f}: ${target}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('src/client does not import src/server', () => {
    const violations: string[] = [];
    for (const f of listTs(CLIENT_DIR)) {
      const raw = strip(readFileSync(f, 'utf8'), false);
      for (const target of importTargets(raw)) {
        if (/(^|\/)server(\/|$)/.test(target)) violations.push(`${f}: ${target}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('scanner self-check: flags stray literals, ignores comments, strings, identifiers', () => {
    expect(findLiterals('x.ts', 'const a = 5;')).toHaveLength(1);
    expect(findLiterals('x.ts', 'const a = 0.5;')).toHaveLength(1);
    expect(findLiterals('x.ts', '// 7\nconst s = "42"; const t = `9`; Math.atan2(0, 1); Math.PI;')).toEqual([]);
    expect(findLiterals('x.ts', 'const K = 0x6d2b79f5;')).toHaveLength(1);
    expect(findLiterals('rng.ts', 'const K = 0x6d2b79f5;')).toEqual([]);
    expect(findLiterals('rng.ts', 'x = y >>> 15;')).toHaveLength(1);
  });
});
