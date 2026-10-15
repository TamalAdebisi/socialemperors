// A building on fire (CLIENT.md, "Defending the town"), as the Flash client
// shows it: the game's flames over it, more of them as it loses life,
// placed at the building's own point.

import { Assets, Sprite, type Texture } from "pixi.js";

import anchors from "./art/anchors.json" with { type: "json" };

const PICTURES = [1, 2, 3, 4].map((stage) => new URL(`./art/fire-${stage}.webp`, import.meta.url).href);

/** How much a building burns: 0 whole, 1 below 100%, 2 below 67%, 3 below 34%, 4 burnt out. */
export function fireStage(life: number, maxLife: number): number {
  if (maxLife <= 0 || life >= maxLife) {
    return 0;
  }
  const percent = Math.floor((100 * Math.max(0, life)) / maxLife);
  return percent >= 67 ? 1 : percent >= 34 ? 2 : percent >= 1 ? 3 : 4;
}

/** The flames for a stage (1 to 4), to put at the building's point. */
export async function fireSprite(stage: number): Promise<Sprite> {
  const texture = await Assets.load<Texture>(PICTURES[Math.min(4, Math.max(1, stage)) - 1]);
  const anchor = (anchors as Record<string, { x: number; y: number; scale: number }>)[`fire-${stage}`];
  const sprite = new Sprite(texture);
  sprite.anchor.set(anchor.x, anchor.y);
  sprite.scale.set(1 / anchor.scale);
  return sprite;
}
