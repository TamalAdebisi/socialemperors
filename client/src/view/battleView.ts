// Draws a battle: the island's ground, every fighter where rules/battle.ts
// has it (walking, fighting, falling), the shots in the air, life bars and
// the damage that rises from a hit. It only draws: the battle decides.

import { ColorMatrixFilter, Container, Graphics, Sprite } from "pixi.js";

import { DEAD_FRAMES, ENEMY, SELF, type Battle, type BattleEvent, type Fighter, type Shot } from "../rules/battle.ts";
import type { ItemInfo } from "../rules/config.ts";
import { BLOCK_TILES, BLOCKS, MAP_TILES, buildingOrigin, buildingPoint, type Point } from "../rules/geometry.ts";
import type { PlacedItem } from "../rules/town.ts";
import { anchorOf, type ArtLibrary } from "./art.ts";
import { isOpaqueAt } from "./hit.ts";
import { Markers } from "./markers.ts";
import { buildingSprite, unitSprite, type Pose } from "./townView.ts";
import type { Effect } from "../sound.ts";

/** The units whose death cry is a woman's: villager women, healers, the princess, the valkyrie. */
const WOMEN = new Set([501, 502, 590, 533, 554]);

/** A life bar shows this long after a hit (and while selected). */
const BAR_FRAMES = 3 * 30;
const BAR_WIDTH = 44;
/** The Flash client's colours for damage: what the player's things take, what enemies take, healing. */
const COLOUR_HURT_MINE = 0xff5a4a;
const COLOUR_HURT_THEIRS = 0xffe35a;
const COLOUR_HEAL = 0x6fe36f;

interface Drawn {
  slot: Container;
  /** What the picture shows now: redrawn only when it changes. */
  key: string;
  bar: Graphics;
  /** The frame its life bar shows until. */
  barUntil: number;
  ring: Graphics | null;
}

export class BattleView {
  readonly root = new Container();
  private readonly ground = new Container();
  private readonly rings = new Container();
  private readonly things = new Container();
  private readonly air = new Container();
  /** Life bars, over everything. */
  private readonly bars = new Container();
  private readonly markers = new Markers();
  private readonly art: ArtLibrary;
  private readonly battle: Battle;
  private readonly drawn = new Map<Fighter, Drawn>();
  private readonly shots = new Map<Shot, Sprite>();
  private readonly glow = new ColorMatrixFilter();
  /** The units the player has picked, outlined on the ground. */
  selected = new Set<Fighter>();
  private hovered: Fighter | null = null;

  private readonly sound: (effect: Effect) => void;

  constructor(art: ArtLibrary, battle: Battle, sound: (effect: Effect) => void = () => {}) {
    this.art = art;
    this.battle = battle;
    this.sound = sound;
    this.things.sortableChildren = true;
    this.glow.brightness(1.4, false);
    this.root.addChild(this.ground, this.rings, this.things, this.air, this.bars, this.markers.layer);
  }

  /** The island's ground: one terrain picture per block of 20 x 20 tiles, the sea's included. */
  async drawGround(terrain: ItemInfo | undefined, shape: number[]): Promise<boolean> {
    const art = terrain ? await this.art.get(terrain.art) : null;
    if (!art) {
      return false;
    }
    for (let gy = 0; gy < BLOCKS; gy++) {
      for (let gx = 0; gx < BLOCKS; gx++) {
        // The island's numbers are Flash frames, which count from 1; our sheets count from 0.
        const frame = Math.max(0, Math.min((shape[gy * BLOCKS + gx] ?? 1) - 1, art.framesOf("frame") - 1));
        const name = `frame/${frame}`;
        const texture = art.animation(name)?.[0];
        const bounds = art.boundsOf(name);
        if (!texture || !bounds) {
          continue;
        }
        const sprite = new Sprite(texture);
        sprite.anchor.copyFrom(anchorOf(texture));
        const at = buildingOrigin(buildingPoint(BLOCK_TILES * gx + BLOCK_TILES - 1, BLOCK_TILES * gy + BLOCK_TILES - 1), bounds);
        sprite.position.set(at.x, at.y);
        // A few pixels bigger, so the sea doesn't show through the seams between blocks.
        sprite.scale.set(1 + 4 / Math.max(texture.width, 1));
        this.ground.addChild(sprite);
      }
    }
    return true;
  }

  /** Load every picture the battle needs; `progress` hears how many are ready. Returns the art missing. */
  async load(progress: (done: number, total: number) => void): Promise<string[]> {
    const names = new Set(this.battle.fighters.map((f) => f.item.art));
    const missing: string[] = [];
    let done = 0;
    progress(0, names.size);
    await Promise.all([...names].map(async (name) => {
      if (!(await this.art.get(name))) {
        missing.push(name);
      }
      progress(++done, names.size);
    }));
    return missing;
  }

  /** Draw the battle as it is now: called every screen frame. */
  update(ms: number, zoom: number): void {
    this.markers.tick(ms, zoom);
    for (const event of this.battle.takeEvents()) {
      this.event(event);
    }
    for (const fighter of this.battle.fighters) {
      this.drawFighter(fighter);
    }
    for (const [shot, sprite] of this.shots) {
      this.placeShot(shot, sprite);
    }
  }

  private event(event: BattleEvent): void {
    switch (event.kind) {
      case "hit": {
        const drawn = this.drawn.get(event.fighter);
        if (drawn) {
          drawn.barUntil = this.battle.frame + BAR_FRAMES;
        }
        // A sword's sound for a hit up close, as the Flash client plays it.
        if (!event.heal && event.by?.isUnit && event.by.range <= 1 && event.by !== event.fighter) {
          this.sound(Math.random() < 0.5 ? "sword-1" : "sword-2");
        }
        const colour = event.heal ? COLOUR_HEAL : event.fighter.side === SELF ? COLOUR_HURT_MINE : COLOUR_HURT_THEIRS;
        this.markers.rise(this.topOf(event.fighter), [{ text: `${event.heal ? "+" : "-"}${event.amount}${event.crit ? "!" : ""}`, colour }]);
        break;
      }
      case "shot": {
        void this.addShot(event.shot);
        const type = event.shot.type;
        this.sound(type === 2 || type === 19 ? "ballista" : type === 3 || type === 4 || type === 13 ? "cannon" : "arrow");
        break;
      }
      case "landed": {
        const sprite = this.shots.get(event.shot);
        sprite?.destroy();
        this.shots.delete(event.shot);
        break;
      }
      case "died": {
        const f = event.fighter;
        if (!f.isUnit) {
          this.remove(f);
          break;
        }
        this.sound(WOMEN.has(f.item.id) ? "die-woman"
          : f.item.race === "t" || f.item.subcategory === 84 ? "die-troll"
            : f.item.subcategory === 81 ? "die-machine" : "die-man");
        break;
      }
      case "gone":
        this.remove(event.fighter);
        break;
    }
  }

  /** Words or numbers rising from a fighter (what a kill paid). */
  rise(fighter: Fighter, lines: { text: string; colour: number }[]): void {
    this.markers.rise(this.topOf(fighter), lines);
  }

  private remove(fighter: Fighter): void {
    const drawn = this.drawn.get(fighter);
    if (drawn) {
      drawn.slot.destroy({ children: true });
      drawn.bar.destroy();
      drawn.ring?.destroy();
      this.drawn.delete(fighter);
    }
    this.selected.delete(fighter);
  }

  private drawFighter(fighter: Fighter): void {
    let drawn = this.drawn.get(fighter);
    if (!drawn) {
      const slot = new Container();
      const bar = new Graphics();
      drawn = { slot, key: "", bar, barUntil: 0, ring: null };
      this.drawn.set(fighter, drawn);
      this.things.addChild(slot);
      this.bars.addChild(bar);
    }
    const pose = this.poseOf(fighter);
    const key = fighter.isUnit ? `${pose} ${fighter.facing}` : `b ${fighter.facing}`;
    if (key !== drawn.key) {
      drawn.key = key;
      void this.paint(fighter, drawn, pose);
    }
    if (fighter.isUnit) {
      const picture = drawn.slot.children[0];
      picture?.position.set(fighter.at.x, fighter.at.y);
      // Further down the screen is nearer: drawn later.
      drawn.slot.zIndex = 20000 + fighter.at.y;
      if (fighter.dead) {
        // Lies 4 seconds, then fades for 1.
        const age = this.battle.frame - fighter.diedAt;
        drawn.slot.alpha = Math.max(0, Math.min(1, (DEAD_FRAMES - age) / 30));
      }
    } else {
      drawn.slot.zIndex = 20000 + buildingPoint(fighter.tx, fighter.ty).y - 27 * (fighter.item.width + fighter.item.height) / 2;
    }
    drawn.slot.filters = fighter === this.hovered || fighter.collectable ? [this.glow] : [];
    this.drawBar(fighter, drawn);
    this.drawRing(fighter, drawn);
  }

  /** What a unit is doing, for its picture. */
  private poseOf(fighter: Fighter): Pose {
    if (fighter.dead) {
      return "MUERTE";
    }
    if (fighter.next) {
      return "ANDAR";
    }
    if (fighter.attacking && fighter.target && fighter.struckAt >= 0 && this.battle.frame - fighter.struckAt < Math.max(fighter.interval, 30)) {
      return "ATAQUE";
    }
    return "QUIETO";
  }

  private async paint(fighter: Fighter, drawn: Drawn, pose: Pose): Promise<void> {
    const art = await this.art.get(fighter.item.art);
    if (drawn.slot.destroyed || drawn.key !== (fighter.isUnit ? `${pose} ${fighter.facing}` : `b ${fighter.facing}`)) {
      return;
    }
    drawn.slot.removeChildren().forEach((child) => child.destroy());
    if (!art) {
      drawn.slot.addChild(outline(fighter));
    } else if (fighter.isUnit) {
      drawn.slot.addChild(unitSprite(art, fighter.facing, pose, fighter.at, pose === "MUERTE"));
    } else {
      drawn.slot.addChild(buildingSprite(art, asPlaced(fighter), 0));
    }
  }

  private drawBar(fighter: Fighter, drawn: Drawn): void {
    const show = !fighter.dead && fighter.side !== 3
      && (this.selected.has(fighter) || fighter === this.hovered || this.battle.frame < drawn.barUntil);
    drawn.bar.visible = show;
    if (!show) {
      return;
    }
    const top = this.topOf(fighter);
    const share = Math.max(0, fighter.life / fighter.maxLife);
    drawn.bar.clear()
      .rect(top.x - BAR_WIDTH / 2 - 1, top.y - 10, BAR_WIDTH + 2, 7).fill(0x1b130b)
      .rect(top.x - BAR_WIDTH / 2, top.y - 9, BAR_WIDTH * share, 5).fill(fighter.side === ENEMY ? 0xe0533d : 0x5fd35f);
  }

  private drawRing(fighter: Fighter, drawn: Drawn): void {
    const want = this.selected.has(fighter) && !fighter.dead;
    if (!want) {
      drawn.ring?.destroy();
      drawn.ring = null;
      return;
    }
    if (!drawn.ring) {
      drawn.ring = new Graphics().ellipse(0, 0, 34, 17).stroke({ color: 0x7cf27c, width: 3, alpha: 0.9 });
      this.rings.addChild(drawn.ring);
    }
    drawn.ring.position.set(fighter.at.x, fighter.at.y);
  }

  private async addShot(shot: Shot): Promise<void> {
    const sprite = new Sprite();
    this.shots.set(shot, sprite);
    this.air.addChild(sprite);
    const art = await this.art.get(`projectile_${shot.type}`);
    if (sprite.destroyed) {
      return;
    }
    const texture = art?.animation("frame/0")?.[0];
    if (texture) {
      sprite.texture = texture;
      sprite.anchor.copyFrom(anchorOf(texture));
    }
    this.placeShot(shot, sprite);
  }

  /** A shot along its arc: straight from shooter to target, lifted in the middle. */
  private placeShot(shot: Shot, sprite: Sprite): void {
    const t = Math.min(1, shot.frame / shot.frames);
    const lift = shot.frames * 4 * shot.arc;
    const at = (u: number): Point => ({
      x: shot.from.x + (shot.to.x - shot.from.x) * u,
      y: shot.from.y + (shot.to.y - shot.from.y) * u - lift * 4 * u * (1 - u),
    });
    const now = at(t);
    const ahead = at(Math.min(1, t + 0.05));
    sprite.position.set(now.x, now.y);
    // The pictures point down; turn them along the flight.
    sprite.rotation = Math.atan2(ahead.y - now.y, ahead.x - now.x) - Math.PI / 2;
  }

  /** The fighter whose picture is under a point of the screen, the one in front. */
  fighterAt(screen: Point): Fighter | null {
    const slots = [...this.drawn].sort(([, a], [, b]) => b.slot.zIndex - a.slot.zIndex);
    for (const [fighter, drawn] of slots) {
      const picture = drawn.slot.children[0];
      if (!fighter.dead && picture && isOpaqueAt(picture, screen)) {
        return fighter;
      }
    }
    return null;
  }

  hover(fighter: Fighter | null): void {
    this.hovered = fighter;
  }

  /** The top middle of a fighter's picture, on the map. */
  private topOf(fighter: Fighter): Point {
    const picture = this.drawn.get(fighter)?.slot.children[0];
    const bounds = picture?.getLocalBounds();
    if (picture && bounds && bounds.width > 0) {
      return { x: picture.x + bounds.x + bounds.width / 2, y: picture.y + bounds.y };
    }
    return { x: fighter.at.x, y: fighter.at.y - 60 };
  }
}

/** A building fighter as the town's drawing wants it. */
function asPlaced(fighter: Fighter): PlacedItem {
  return { item: fighter.item, tx: fighter.tx, ty: fighter.ty, orientation: fighter.facing, unitsInside: 0, startedAt: null, workTime: 0 };
}

/** An item without art yet: its footprint. */
function outline(fighter: Fighter): Graphics {
  const w = fighter.isUnit ? 1 : fighter.item.width;
  const h = fighter.isUnit ? 1 : fighter.item.height;
  const p = fighter.isUnit ? { x: fighter.at.x, y: fighter.at.y + 27 } : buildingPoint(fighter.tx, fighter.ty);
  const colour = fighter.side === SELF ? 0x7cf27c : fighter.side === ENEMY ? 0xe0533d : 0xffffff;
  return new Graphics()
    .poly([p.x, p.y, p.x + 54 * h, p.y - 27 * h, p.x + 54 * (h - w), p.y - 27 * (w + h), p.x - 54 * w, p.y - 27 * w])
    .fill({ color: colour, alpha: 0.25 })
    .stroke({ color: colour, alpha: 0.8, width: 2 });
}

/** The whole island, in tiles: for keeping the camera over it. */
export const ISLAND_TILES = MAP_TILES;
