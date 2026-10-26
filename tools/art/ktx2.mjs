// One sheet page as KTX2: the page as the graphics chip keeps it, four times
// smaller there than its decoded WebP (CLIENT.md, "Light art"). Basis
// Universal's UASTC, with Zstandard on top and the smaller copies for
// zooming out, from the page's pixels with colours premultiplied by alpha
// (tools/art/pack_sheet.py writes them, then calls this). Run with the
// packages of tools/art/package.json installed (npm ci --prefix tools/art).
//
//   node tools/art/ktx2.mjs <page.rgba> <width> <height> <page.ktx2>
//
// The encoder takes pages of up to 12 Mpix (4096 x 3072).

import { readFileSync, writeFileSync } from "node:fs";
import { encodeToKTX2 } from "ktx2-encoder";

const [input, width, height, output] = process.argv.slice(2);
if (!output) {
  console.error("Usage: node tools/art/ktx2.mjs <page.rgba> <width> <height> <page.ktx2>");
  process.exit(2);
}
const data = new Uint8Array(readFileSync(input));
const w = Number(width), h = Number(height);
if (data.length !== w * h * 4) {
  console.error(`${input}: ${data.length} bytes, not ${w} x ${h} RGBA`);
  process.exit(1);
}
const ktx2 = await encodeToKTX2(new Uint8Array(1), {
  // UASTC: close to the original (36 dB on a real page, against ETC1S's 30), for about twice the WebP's download.
  isUASTC: true,
  needSupercompression: true,
  generateMipmap: true,
  // The colours are the art's, as the screen shows them; premultiplied already, so linear blending holds.
  isPerceptual: true,
  isKTX2File: true,
  imageDecoder: async () => ({ data, width: w, height: h }),
});
writeFileSync(output, ktx2);
