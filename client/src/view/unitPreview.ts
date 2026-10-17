// The units book's walking/attack/special preview, using the existing atlas.
// Only an expanded, visible card draws; closing it also cancels late loads.
import type { ItemInfo } from "../rules/config.ts";
import type { ArtLibrary } from "./art.ts";
import { anchorOf } from "./art.ts";

export function unitPreview(art: ArtLibrary, item: ItemInfo, canvas: HTMLCanvasElement, active: () => boolean): () => void {
  let stopped = false, frame = 0;
  const stop = () => { stopped = true; cancelAnimationFrame(frame); };
  void art.get(item.art).then((sheet) => {
    if (!sheet || stopped || !active()) return;
    const runs = [1, 2, 6].map((n) => sheet.numbered(n, 3)).filter((run) => run && run.length > 0);
    if (!runs.length) return;
    const textures = runs.flatMap((run) => run!);
    const boxes = textures.map((t) => {
      const a = anchorOf(t), trim = t.trim;
      return { x: (trim?.x ?? 0) - a.x * t.orig.width, y: (trim?.y ?? 0) - a.y * t.orig.height,
        w: trim?.width ?? t.orig.width, h: trim?.height ?? t.orig.height };
    });
    const left = Math.min(...boxes.map((b) => b.x)), top = Math.min(...boxes.map((b) => b.y));
    const width = Math.max(...boxes.map((b) => b.x + b.w)) - left;
    const height = Math.max(...boxes.map((b) => b.y + b.h)) - top;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round((canvas.clientWidth || 140) * ratio);
    canvas.height = Math.round((canvas.clientHeight || 100) * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = Math.min(canvas.width / Math.max(1,width), canvas.height / Math.max(1,height), 1.5 * ratio);
    const started = performance.now();
    const draw = (now: number) => {
      if (stopped || !active() || !canvas.isConnected) return;
      const elapsed = now - started;
      const run = runs[Math.floor(elapsed / 3000) % runs.length]!;
      const texture = run[Math.floor((elapsed % 3000) * sheet.fps / 1000) % run.length];
      const source = texture.source.resource as CanvasImageSource | undefined;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (source) {
        const a = anchorOf(texture), trim = texture.trim, f = texture.frame, r = texture.source.resolution;
        const x = (trim?.x ?? 0) - a.x * texture.orig.width;
        const y = (trim?.y ?? 0) - a.y * texture.orig.height;
        context.drawImage(source, f.x*r, f.y*r, f.width*r, f.height*r,
          (canvas.width-width*scale)/2+(x-left)*scale, (canvas.height-height*scale)/2+(y-top)*scale,
          f.width*scale, f.height*scale);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
  });
  return stop;
}
