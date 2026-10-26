// Reads a sheet page's KTX2 file (tools/art/ktx2.mjs) into the graphics
// chip's own format, off the page, with the KTX library PixiJS ships
// (libktx). Our own worker, not PixiJS's: that one never frees what it
// read, and its WebAssembly memory only grows, by tens of MB a page.
// Only the sizes WebGL takes come back: whole blocks of 4 each way, from
// the half-size copy for light art (view/art.ts, ArtLibrary.ktx2).

interface Ktx {
  ktxTexture: new (data: Uint8Array) => KtxTexture;
  TranscodeTarget: Record<string, unknown>;
  ErrorCode: { SUCCESS: unknown };
}

interface KtxTexture {
  baseWidth: number;
  baseHeight: number;
  numLevels: number;
  needsTranscoding: boolean;
  transcodeBasis(target: unknown, flags: number): unknown;
  getImageData(level: number, layer: number, face: number): Uint8Array;
  delete(): void;
}

/** What the page asks: the file, the library, the formats the chip takes (best first), and whether at half size. */
export interface Ask {
  id: number;
  url: string;
  jsUrl: string;
  wasmUrl: string;
  formats: string[];
  half: boolean;
}

export type Answer =
  | { id: number; levels: Uint8Array[]; format: string; width: number; height: number }
  | { id: number; error: string };

/** The library's name for each format the graphics chip may take. */
const TARGETS: Record<string, string> = {
  "bc7-rgba-unorm": "BC7_M5_RGBA",
  "astc-4x4-unorm": "ASTC_4x4_RGBA",
  "etc2-rgba8unorm": "ETC2_RGBA",
  "bc3-rgba-unorm": "BC3_RGBA",
};

const scope = globalThis as unknown as {
  importScripts(url: string): void;
  LIBKTX(options: { locateFile(): string }): Promise<Ktx>;
  postMessage(message: Answer, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<Ask>) => void) | null;
};

let library: Promise<Ktx> | null = null;

async function read({ url, jsUrl, wasmUrl, formats, half }: Ask): Promise<Omit<Extract<Answer, { levels: unknown }>, "id">> {
  library ??= (() => {
    scope.importScripts(jsUrl);
    return scope.LIBKTX({ locateFile: () => wasmUrl });
  })();
  const ktx = await library;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const format = formats.find((name) => TARGETS[name]);
  if (!format) throw new Error("no format the graphics chip takes");
  const texture = new ktx.ktxTexture(new Uint8Array(await response.arrayBuffer()));
  try {
    if (!texture.needsTranscoding) throw new Error(`${url}: not Basis Universal`);
    if (texture.transcodeBasis(ktx.TranscodeTarget[TARGETS[format]], 0) !== ktx.ErrorCode.SUCCESS) {
      throw new Error(`${url}: can't be read as ${format}`);
    }
    const first = half ? 1 : 0;
    const levels: Uint8Array[] = [];
    for (let level = first; level < texture.numLevels; level++) {
      if ((texture.baseWidth >> level) % 4 || (texture.baseHeight >> level) % 4) break;
      levels.push(texture.getImageData(level, 0, 0).slice());  // out of the library's memory
    }
    if (levels.length === 0) throw new Error(`${url}: ${texture.baseWidth} x ${texture.baseHeight} isn't in whole blocks`);
    return { levels, format, width: texture.baseWidth >> first, height: texture.baseHeight >> first };
  } finally {
    texture.delete();  // what PixiJS's reader forgets: the library's memory back for the next page
  }
}

scope.onmessage = (event) => {
  const ask = event.data;
  read(ask).then(
    (page) => scope.postMessage({ id: ask.id, ...page }, page.levels.map((level) => level.buffer as ArrayBuffer)),
    (error: unknown) => scope.postMessage({ id: ask.id, error: String(error) }, []),
  );
};
