/** 5x7 pixel font drawn in code, so it is embedded in the build and never falls back to a system font. */
const RAW: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.####|#....|#....|#....|#....|#....|.####',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.####|#....|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '#####|..#..|..#..|..#..|..#..|..#..|#####',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '####.|....#|....#|.###.|....#|....#|####.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
  ':': '.....|..#..|..#..|.....|..#..|..#..|.....',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  '/': '....#|...#.|...#.|..#..|.#...|.#...|#....',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
  '[': '.###.|.#...|.#...|.#...|.#...|.#...|.###.',
  ']': '.###.|...#.|...#.|...#.|...#.|...#.|.###.',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  ',': '.....|.....|.....|.....|.##..|..#..|.#...',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
  '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '(': '..#..|.#...|#....|#....|#....|.#...|..#..',
  ')': '..#..|...#.|....#|....#|....#|...#.|..#..',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
const ADVANCE = GLYPH_W + 1;

const GLYPHS = new Map<string, string[]>(Object.entries(RAW).map(([k, v]) => [k, v.split('|')]));

export function measureText(text: string, scale: number): number {
  return Math.max(0, text.length * ADVANCE - 1) * scale;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  const width = measureText(text, scale);
  let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  cx = Math.round(cx);
  y = Math.round(y);
  ctx.fillStyle = color;
  for (const ch of text.toUpperCase()) {
    const rows = GLYPHS.get(ch) ?? GLYPHS.get(' ');
    if (rows) {
      for (let r = 0; r < GLYPH_H; r++) {
        const row = rows[r] ?? '';
        for (let c = 0; c < GLYPH_W; c++) {
          if (row[c] === '#') ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
        }
      }
    }
    cx += ADVANCE * scale;
  }
}

interface RichPart {
  text: string;
  key: boolean;
}

/** Splits "PRESS [F] TO RECORD" into plain parts and key-cap parts. */
function richParts(text: string): RichPart[] {
  const parts: RichPart[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), key: false });
    parts.push({ text: m[1] ?? '', key: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), key: false });
  return parts;
}

/** Key caps are padded by this many font pixels on each side. */
const KEY_PAD = 3;

function partWidth(p: RichPart, scale: number): number {
  return measureText(p.text, scale) + (p.key ? KEY_PAD * 2 * scale : 0);
}

export function measureRich(text: string, scale: number): number {
  return richParts(text).reduce((w, p) => w + partWidth(p, scale), 0);
}

/**
 * Text where [WORDS] in brackets are drawn as key caps: an outlined box in `keyColor` with the word inside.
 * The box sits a little above and below the text line, so a line of prompts reads like a keyboard.
 */
export function drawRich(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: string,
  keyColor: string,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  const parts = richParts(text);
  const width = parts.reduce((w, p) => w + partWidth(p, scale), 0);
  let cx = Math.round(align === 'center' ? x - width / 2 : align === 'right' ? x - width : x);
  for (const p of parts) {
    const w = partWidth(p, scale);
    if (p.key) {
      const top = Math.round(y - 3 * scale);
      const h = (GLYPH_H + 6) * scale;
      const t = Math.max(1, Math.round(scale * 0.8));
      ctx.fillStyle = keyColor;
      ctx.globalAlpha *= 0.18;
      ctx.fillRect(cx, top, w, h);
      ctx.globalAlpha /= 0.18;
      ctx.fillRect(cx, top, w, t);
      ctx.fillRect(cx, top + h - t * 2, w, t * 2);
      ctx.fillRect(cx, top, t, h);
      ctx.fillRect(cx + w - t, top, t, h);
      drawText(ctx, p.text, cx + KEY_PAD * scale, y, scale, keyColor);
    } else {
      drawText(ctx, p.text, cx, y, scale, color);
    }
    cx += w;
  }
}
