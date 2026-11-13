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

/** Rows of tape spines on a dark shelf. */
export function makeShelfTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx, size) => {
    const rnd = lcg(21);
    const spines = ['#7a2a2a', '#2c4a78', '#a39448', '#2d5d49', '#5d6260', '#8c5530', '#38405a', '#1a1c1d'];
    ctx.fillStyle = '#141311';
    ctx.fillRect(0, 0, size, size);
    const rows = 5;
    const band = size / rows;
    for (let r = 0; r < rows; r++) {
      const base = (r + 1) * band - 3;
      let x = 3;
      while (x < size - 6) {
        const w = 5 + Math.floor(rnd() * 5);
        const h = band * (0.65 + rnd() * 0.25);
        ctx.fillStyle = spines[Math.floor(rnd() * spines.length)] ?? '#444';
        ctx.fillRect(x, base - h, w, h);
        ctx.fillStyle = 'rgba(230,240,235,0.55)';
        ctx.fillRect(x + 1, base - h + 5, Math.max(1, w - 2), 6);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + w - 1, base - h, 1, h);
        x += w + 1;
      }
      ctx.fillStyle = '#2a241e';
      ctx.fillRect(0, base, size, 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
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
