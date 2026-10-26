// The units book's walking/attack/special preview, from the unit's own
// sheet: its pictures for those moves cut out of the sheet's files
// (ArtLibrary.cutouts), nothing put on the graphics chip, let go when the
// card closes. Only an expanded, visible card draws; closing it also
// cancels late loads.
import type { ItemInfo } from "../rules/config.ts";
import type { ArtLibrary, Cutout } from "./art.ts";

/** The moves shown, one after another: walking, attacking, the first special; facing the viewer (way 3). */
const MOVES = [1, 2, 6];
const WAY = 3;

export function unitPreview(art: ArtLibrary, item: ItemInfo, canvas: HTMLCanvasElement, active: () => boolean,
  missing?: () => void): () => void {
  let stopped = false, frame = 0;
  let pictures: Cutout[] = [];
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    for (const picture of pictures) picture.image.close();
    pictures = [];
  };
  void art.cutouts(item.art, (all) => MOVES.map((move) => all[move * 5 + WAY]?.[1] ?? [])).then((cut) => {
    const runs = cut ? cut.runs.filter((run) => run.length > 0) : [];
    pictures = [...new Set(runs.flat())];
    if (stopped || !active()) {
      stop();
      return;
    }
    if (!cut || !runs.length) {
      missing?.();  // no sheet to draw from: the caller shows something else
      return;
    }
    const left = Math.min(...pictures.map((b) => b.x)), top = Math.min(...pictures.map((b) => b.y));
    const width = Math.max(...pictures.map((b) => b.x + b.width)) - left;
    const height = Math.max(...pictures.map((b) => b.y + b.height)) - top;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round((canvas.clientWidth || 140) * ratio);
    canvas.height = Math.round((canvas.clientHeight || 100) * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = Math.min(canvas.width / Math.max(1,width), canvas.height / Math.max(1,height), 1.5 * ratio);
    const started = performance.now();
    const draw = (now: number) => {
      if (stopped || !active() || !canvas.isConnected) return;
      // A delayed first RAF can carry a timestamp just before setup ran.
      const elapsed = Math.max(0, now - started);
      const run = runs[Math.floor(elapsed / 3000) % runs.length]!;
      const picture = run[Math.floor((elapsed % 3000) * cut.fps / 1000) % run.length];
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(picture.image, (canvas.width-width*scale)/2+(picture.x-left)*scale,
        (canvas.height-height*scale)/2+(picture.y-top)*scale, picture.width*scale, picture.height*scale);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
  });
  return stop;
}
