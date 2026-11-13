import * as THREE from 'three';

/** Small seeded generator so the shop looks the same on every load. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Lino: two dull greys in a 2 m by 2 m tile, scuffed. */
export function makeFloorTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx, size) => {
    const rnd = lcg(7);
    const half = size / 2;
    ctx.fillStyle = '#26292a';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1d2021';
    ctx.fillRect(0, 0, half, half);
    ctx.fillRect(half, half, half, half);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rnd() * 0.04})`;
      ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 6, 1 + rnd() * 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  });
}

/**
 * A video-store wall: black clamshell VHS spines with white labels, ten boards to a 2 m wall.
 * The texture is one metre wide and two tall, so a pixel is about 4 mm across and 8 mm up. A tape is about 2.5 cm wide
 * and 19 cm tall, so a spine here is 6 to 8 px wide and 23 px tall.
 */
export function makeShelfTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx, size) => {
    const rnd = lcg(21);
    const stickers = ['#c8323a', '#3d6bd1', '#d6c24a', '#3f9b6e', '#e8e8e8'];
    ctx.fillStyle = '#0d0d0c';
    ctx.fillRect(0, 0, size, size);
    const boards = 10;
    const band = size / boards;
    for (let r = 0; r < boards; r++) {
      const base = (r + 1) * band - 2;
      let x = 3;
      while (x < size - 8) {
        // An empty gap now and then, and the odd tape leaning in it
        if (rnd() < 0.035) {
          x += 4 + Math.floor(rnd() * 8);
          continue;
        }
        const w = 6 + Math.floor(rnd() * 3);
        const h = band * (0.84 + rnd() * 0.08);
        const top = base - h;
        // Black shell with a lit left edge
        ctx.fillStyle = '#0a0b0b';
        ctx.fillRect(x, top, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x, top, 1, h);
        // White label with two lines of print
        const lh = Math.floor(h * 0.62);
        ctx.fillStyle = '#e4e8e4';
        ctx.fillRect(x + 1, top + 2, w - 2, lh);
        ctx.fillStyle = 'rgba(20,22,22,0.75)';
        ctx.fillRect(x + 1, top + 4, w - 2, 1);
        ctx.fillRect(x + 1, top + 7, Math.max(1, w - 4), 1);
        // Rental sticker on some
        if (rnd() < 0.35) {
          ctx.fillStyle = stickers[Math.floor(rnd() * stickers.length)] ?? '#c8323a';
          ctx.fillRect(x + 1, top + lh - 3, w - 2, 2);
        }
        // The tape window at the foot of the spine
        ctx.fillStyle = 'rgba(180,190,185,0.22)';
        ctx.fillRect(x + 2, base - 3, Math.max(1, w - 4), 2);
        x += w + 1;
      }
      ctx.fillStyle = '#26211b';
      ctx.fillRect(0, base, size, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, 4, size);
    ctx.fillRect(size - 4, 0, 4, size);
  });
}

export function makeWallTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (ctx, size) => {
    const rnd = lcg(33);
    ctx.fillStyle = '#1e2121';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + rnd() * 0.03})`;
      ctx.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 10, 2 + rnd() * 10);
    }
  });
}

export function makeCeilingTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (ctx, size) => {
    ctx.fillStyle = '#17191a';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#0c0d0d';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, size, size);
  });
}
