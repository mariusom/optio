// Generates the PWA PNG icons from the public/icon.svg design (a light "o" on
// the default primary colour) without image libraries: raw RGBA raster + zlib
// deflate + PNG chunk assembly. The "o" is drawn as an elliptical ring so the
// output does not depend on installed fonts.
// Run: node scripts/gen-icons.ts
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

// Colours from public/icon.svg (default --primary / --primary-foreground).
const background = [0x17, 0x17, 0x17];
const foreground = [0xfa, 0xfa, 0xfa];

// Glyph proportions of the semibold "o" in icon.svg's 100-unit viewBox.
const glyph = { rx: 15.5, ry: 16.5, strokeX: 7, strokeY: 5.75 };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// Inside the outer ellipse and outside the inner one, anti-aliased over about
// one pixel using approximate distances in viewBox units.
const ringCoverage = (x: number, y: number, pixelUnits: number) => {
  const radius = Math.min(glyph.rx, glyph.ry);
  const outer = (Math.hypot(x / glyph.rx, y / glyph.ry) - 1) * radius;
  const innerRadius = radius - glyph.strokeY;
  const inner =
    (Math.hypot(x / (glyph.rx - glyph.strokeX), y / (glyph.ry - glyph.strokeY)) - 1) * innerRadius;
  return clamp(0.5 - outer / pixelUnits) * clamp(0.5 + inner / pixelUnits);
};

/** Full-bleed square: platforms apply their own corner mask. `scale` shrinks
 *  the glyph for maskable icons, whose safe zone is the central 80% circle. */
const makePixel = (size: number, scale: number) => {
  const units = 100 / size / scale;
  return (x: number, y: number): [number, number, number, number] => {
    const ux = ((x + 0.5) / size) * 100 - 50;
    const uy = ((y + 0.5) / size) * 100 - 50;
    const coverage = ringCoverage(ux / scale, uy / scale, units);
    const mix = (index: number) =>
      Math.round(background[index]! * (1 - coverage) + foreground[index]! * coverage);
    return [mix(0), mix(1), mix(2), 255];
  };
};

mkdirSync("public", { recursive: true });
const outputs: ReadonlyArray<readonly [string, number, number]> = [
  ["icon-180.png", 180, 1],
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-maskable-512.png", 512, 0.8],
];
for (const [name, size, scale] of outputs) {
  const png = encodePng(size, makePixel(size, scale));
  writeFileSync(`public/${name}`, png);
  console.log(`public/${name} (${png.length} bytes)`);
}
