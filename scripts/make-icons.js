import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create SVG Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8f4e00"/>
      <stop offset="50%" stop-color="#ff9933"/>
      <stop offset="100%" stop-color="#056e00"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="210" fill="#ffffff" opacity="0.12"/>
  <g filter="url(#shadow)" fill="#ffffff">
    <!-- Wheat Stalks & Gear Motif -->
    <path d="M256 100 C270 140 270 170 256 210 C242 170 242 140 256 100 Z"/>
    <path d="M256 180 C290 190 310 220 310 250 C280 250 265 220 256 180 Z"/>
    <path d="M256 180 C222 190 202 220 202 250 C232 250 247 220 256 180 Z"/>
    <path d="M256 240 C295 255 315 290 310 325 C275 320 260 285 256 240 Z"/>
    <path d="M256 240 C217 255 197 290 202 325 C237 320 252 285 256 240 Z"/>
    <rect x="250" y="100" width="12" height="290" rx="6" fill="#ffffff"/>
    <!-- Leaf base -->
    <path d="M210 370 C240 360 256 385 256 390 C256 385 272 360 302 370 C280 400 240 400 210 370 Z"/>
  </g>
  <text x="256" y="445" font-family="'Noto Sans', sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="2">
    KISAN SAATHI
  </text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

// 2. Pure Node.js uncompressed PNG generator (RGBA)
function createPNG(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression: 0 (deflate)
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    // CRC32
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeInt32BE(crc, 8 + len);
    return buf;
  }

  // Scanlines: 1 filter byte (0) + 4 bytes per pixel
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // create saffron/gold border & green center styling
      const distFromCenter = Math.sqrt(Math.pow(x - width / 2, 2) + Math.pow(y - height / 2, 2));
      const radius = width * 0.45;
      if (distFromCenter < radius) {
        // Inner circle
        rawData[pxOffset] = 143;     // R
        rawData[pxOffset + 1] = 78;  // G
        rawData[pxOffset + 2] = 0;   // B
        rawData[pxOffset + 3] = 255; // A
      } else {
        // Background
        rawData[pxOffset] = 255;     // R
        rawData[pxOffset + 1] = 153; // G
        rawData[pxOffset + 2] = 51;  // B
        rawData[pxOffset + 3] = 255; // A
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Simple CRC32 implementation
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) | 0;
}

const png192 = createPNG(192, 192, 143, 78, 0);
const png512 = createPNG(512, 512, 143, 78, 0);

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png192);
fs.writeFileSync(path.join(publicDir, 'maskable-icon-512x512.png'), png512);

console.log('✅ Generated PWA icons in public/ successfully!');
