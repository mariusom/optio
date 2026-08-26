// fallow-ignore-file unused-file — tooling, run manually (bun scripts/gen-icons.ts)
// Generates PWA PNG icons (dark rounded square + light-blue θ-ish ring) without
// any image libraries: raw RGBA raster + zlib deflate + PNG chunk assembly.
// Run: bun scripts/gen-icons.ts
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};

const encodePng = (
  size: number,
  pixel: (x: number, y: number) => [number, number, number, number],
) => {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

// Scene: dark slate (#0f172a) rounded square, light-blue (#38bdf8) ring + bar (θ).
const S = [15 / 255, 23 / 255, 42 / 255]; // #0f172a
const C = [56 / 255, 189 / 255, 248 / 255]; // #38bdf8

const makePixel = (size: number) => {
  const radius = size * 0.22;
  const ringR = size * 0.32;
  const ringW = size * 0.075;
  const barH = size * 0.09;
  const cx = size / 2;
  const cy = size / 2;

  const coverage = (px: number, py: number, x0: number, y0: number, x1: number, y1: number) => {
    const cx1 = Math.min(Math.max(px, x0), x1);
    const cy1 = Math.min(Math.max(py, y0), y1);
    const dx = px - cx1,
      dy = py - cy1;
    return Math.min(1, Math.max(0, 1.5 - Math.sqrt(dx * dx + dy * dy)));
  };

  return (x: number, y: number): [number, number, number, number] => {
    const px = x + 0.5,
      py = y + 0.5;
    // Rounded-rect mask
    const rect = Math.min(
      coverage(px, py, radius, 0, size - radius, size),
      coverage(px, py, 0, radius, size, size - radius),
    );
    const inX = px >= radius && px <= size - radius;
    const inY = py >= radius && py <= size - radius;
    const inCorner = (px < radius || px > size - radius) && (py < radius || py > size - radius);
    const cornerRadius = Math.hypot(
      px - (px < radius ? radius : size - radius),
      py - (py < radius ? radius : size - radius),
    );
    const mask =
      inX || inY ? 1 : inCorner ? Math.min(1, Math.max(0, radius - cornerRadius + 1)) : 0;
    const a = mask * 255;

    // Ring: circle band + horizontal bar (θ-like)
    const dist = Math.hypot(px - cx, py - cy);
    const ring = dist >= ringR - ringW && dist <= ringR + ringW ? 1 : 0;
    const bar = py >= cy - barH / 2 && py <= cy + barH / 2 && Math.abs(px - cx) <= ringR ? 1 : 0;
    const glyph = Math.max(ring, bar);

    const r = Math.round((S[0] * (1 - glyph) + C[0] * glyph) * 255);
    const g = Math.round((S[1] * (1 - glyph) + C[1] * glyph) * 255);
    const b = Math.round((S[2] * (1 - glyph) + C[2] * glyph) * 255);
    return [r, g, b, Math.round(a)];
  };
};

mkdirSync("public", { recursive: true });
for (const size of [180, 192, 512]) {
  const png = encodePng(size, makePixel(size));
  writeFileSync(`public/icon-${size}.png`, png);
  console.log(`public/icon-${size}.png (${png.length} bytes)`);
}
