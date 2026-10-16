// Draws a battle: the island's ground, every fighter where rules/battle.ts
// has it (walking, fighting, falling), the shots in the air, life bars and
// the damage that rises from a hit. It only draws: the battle decides.

import { Assets, ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from "pixi.js";

import { DEAD_FRAMES, ENEMY, SELF, type Battle, type BattleEvent, type Effect, type Fighter, type Shot } from "../rules/battle.ts";
import type { ItemInfo } from "../rules/config.ts";
import { BLOCK_TILES, BLOCKS, MAP_TILES, buildingOrigin, buildingPoint, unitFacing, unitPoint, type Point } from "../rules/geometry.ts";
import type { PlacedItem } from "../rules/town.ts";
import { anchorOf, type ArtLibrary } from "./art.ts";
import { fireSprite, fireStage } from "./fire.ts";
import { isOpaqueAt, unitHitDistance } from "./hit.ts";
import { Markers } from "./markers.ts";
import { animated, buildingSprite, unitSprite, type Pose } from "./townView.ts";
import type { Effect as SoundEffect } from "../sound.ts";

/** The units whose death cry is a woman's: villager women, healers, the princess, the valkyrie. */
const WOMEN = new Set([501, 502, 590, 533, 554]);

/** A life bar shows this long after a hit (and while selected). */
const BAR_FRAMES = 3 * 30;
const BAR_WIDTH = 44;
/** The Flash client's colours for damage: what the player's things take, what enemies take, healing. */
const COLOUR_HURT_MINE = 0xff5a4a;
const COLOUR_HURT_THEIRS = 0xffe35a;
const COLOUR_HEAL = 0x6fe36f;
/** Spells' tints: frozen units blue, poisoned ones green. */
const TINT_FROZEN = 0x8ec8ff;
const TINT_POISONED = 0xa8e07a;
/** As the original marks them: a unit a monk turned shows lighter; a monk that has turned its last, and a boss in a rage, redder. */
const CONVERTED = brighter([0.25, 0.25, 0.25]);
const REDDER = brighter([0.25, 0, 0]);
/** The spell marker's picture (the game's AOEMC), and its width in the game: it's drawn (area + 1) / 5 times that. */
const SPELL_AREA = new URL("../ui/art/spell-area.webp", import.meta.url).href;
const SPELL_AREA_WIDTH = 406;
/** How high a unit floats under a seal. */
const LIFT_PIXELS = 40;
/** A lasting effect fades over a second when its time is up. */
const EFFECT_FADE = 30;

interface Playing {
  effect: Effect;
  sprite: Sprite;
  frames: Texture[] | null;
  lastPart: number;
}

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
  /** Spells' pictures: on the ground (under the fighters) and in the air. */
  private readonly floor = new Container();
  private readonly playing: Playing[] = [];
  /** The spell marker while aiming, and what it lights up. */
  private readonly marker = new Sprite();
  private lit = new Set<Fighter>();
  /** The island's look for trees (snow on ice...): the town's at home. */
  skin = 0;
  /** The units the player has picked, outlined on the ground. */
  selected = new Set<Fighter>();
  private hovered: Fighter | null = null;

  private readonly sound: (effect: SoundEffect) => void;

  constructor(art: ArtLibrary, battle: Battle, sound: (effect: SoundEffect) => void = () => {}) {
    this.art = art;
    this.battle = battle;
    this.sound = sound;
    this.things.sortableChildren = true;
    this.glow.brightness(1.4, false);
    this.marker.visible = false;
    this.marker.anchor.set(0.5);
    this.marker.alpha = 0.85;
    void Assets.load<Texture>(SPELL_AREA).then((texture) => {
      this.marker.texture = texture;
    });
    this.root.addChild(this.ground, this.rings, this.marker, this.floor, this.things, this.air, this.bars, this.markers.layer);
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
        // A few pixels bigger all round, grown from its middle, so the sea doesn't show
        // through the seams where blocks meet (their edges are soft, half see-through).
        const grow = 1 + 24 / Math.max(texture.width, 1);
        const middle = sprite.getLocalBounds();
        const cx = middle.x + middle.width / 2;
        const cy = middle.y + middle.height / 2;
        sprite.scale.set(grow);
        sprite.position.set(at.x + cx * (1 - grow), at.y + cy * (1 - grow));
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
    for (const playing of [...this.playing]) {
      this.playEffect(playing);
    }
  }

  /**
   * The spell marker over a square of tiles (its bottom corner `tile`, `area`
   * tiles a side), lighting up `lit`; null hides it.
   */
  aim(aiming: { tile: Point; area: number; lit: Fighter[] } | null): void {
    this.lit = new Set(aiming?.lit ?? []);
    this.marker.visible = aiming !== null;
    if (!aiming) {
      return;
    }
    const half = (aiming.area - 1) / 2;
    const middle = unitPoint(aiming.tile.x - half, aiming.tile.y - half);
    this.marker.position.set(middle.x, middle.y);
    const width = (SPELL_AREA_WIDTH * (aiming.area + 1)) / 5;
    this.marker.scale.set(width / Math.max(1, this.marker.texture.width));
  }

  private async addEffect(effect: Effect): Promise<void> {
    const sprite = new Sprite();
    sprite.visible = false;
    sprite.alpha = effect.alpha ?? 1;
    sprite.scale.set(effect.scale ?? 1);
    sprite.position.set(effect.at.x, effect.at.y);
    (effect.above ? this.air : this.floor).addChild(sprite);
    const playing: Playing = { effect, sprite, frames: null, lastPart: 0 };
    this.playing.push(playing);
    const art = await this.art.get(effect.art);
    if (sprite.destroyed) {
      return;
    }
    if (!art) {
      this.stopEffect(playing);
      return;
    }
    const { frames, lastPart } = art.timeline();
    playing.frames = frames;
    playing.lastPart = lastPart;
  }

  /** An effect at the battle's frame: one picture a frame, going round its last part while it lasts. */
  private playEffect(playing: Playing): void {
    const { effect, sprite, frames } = playing;
    if (!frames) {
      return;
    }
    const age = this.battle.frame - effect.start;
    if (age < 0) {
      return;
    }
    let index = age;
    if (effect.until === undefined) {
      if (age >= frames.length) {
        this.stopEffect(playing);
        return;
      }
    } else {
      if (this.battle.frame >= effect.until + EFFECT_FADE) {
        this.stopEffect(playing);
        return;
      }
      if (index >= frames.length) {
        const loop = Math.max(1, frames.length - playing.lastPart);
        index = playing.lastPart + ((index - frames.length) % loop);
      }
      const fade = Math.max(0, this.battle.frame - effect.until);
      sprite.alpha = (effect.alpha ?? 1) * (1 - fade / EFFECT_FADE);
    }
    const texture = frames[index];
    if (sprite.texture !== texture) {
      sprite.texture = texture;
      sprite.anchor.copyFrom(anchorOf(texture));
    }
    sprite.visible = true;
  }

  private stopEffect(playing: Playing): void {
    playing.sprite.destroy();
    this.playing.splice(this.playing.indexOf(playing), 1);
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
        if (!f.isUnit && !f.ruined) {
          this.remove(f);
          break;
        }
        if (!f.isUnit) {
          break;  // burnt out at home: it stays, in flames
        }
        this.sound(WOMEN.has(f.item.id) ? "die-woman"
          : f.item.race === "t" || f.item.subcategory === 84 ? "die-troll"
            : f.item.subcategory === 81 ? "die-machine" : "die-man");
        break;
      }
      case "gone":
        this.remove(event.fighter);
        break;
      case "effect":
        void this.addEffect(event.effect);
        break;
    }
  }

  /** Words or numbers rising from a fighter (what a kill paid). */
  rise(fighter: Fighter, lines: { text: string; colour: number }[]): void {
    this.markers.rise(this.topOf(fighter), lines);
  }

  /** Words or numbers rising from a point of the map (a spell's name and its mana). */
  riseAt(at: Point, lines: { text: string; colour: number }[]): void {
    this.markers.rise({ x: at.x, y: at.y - 40 }, lines);
  }

  groundClick(at: Point): void {
    this.markers.groundClick(at);
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
    const special = this.specialOf(fighter);
    const key = this.keyOf(fighter, pose, special);
    if (key !== drawn.key) {
      drawn.key = key;
      void this.paint(fighter, drawn, pose, special);
    }
    if (fighter.isUnit) {
      const picture = drawn.slot.children[0];
      // Floating under a seal: drawn higher.
      picture?.position.set(fighter.at.x, fighter.at.y - (this.battle.frame < (fighter.liftedUntil ?? 0) ? LIFT_PIXELS : 0));
      if (picture) {
        // Keep a unit facing the other way mirrored.
        const size = this.sizeOf(fighter);
        picture.scale.set(Math.sign(picture.scale.x || 1) * size, size);
      }
      drawn.slot.tint = this.battle.isFrozen(fighter) ? TINT_FROZEN : fighter.poison ? TINT_POISONED : 0xffffff;
      // Unseen (its own move): see-through.
      drawn.slot.alpha = this.battle.frame < (fighter.hiddenUntil ?? 0) ? 0.4 : 1;
      if (fighter.fadingSince !== undefined) {
        drawn.slot.alpha = Math.max(0, 1 - (this.battle.frame - fighter.fadingSince) / 15);
      }
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
    const glow = fighter === this.hovered || fighter.collectable || this.lit.has(fighter) ? this.glow : null;
    const mark = fighter.converted ? CONVERTED : (fighter.conversions ?? 0) >= 4 || fighter.enraged ? REDDER : null;
    const filters = [glow, mark].filter((f) => f !== null);
    const now = drawn.slot.filters ?? [];
    if (filters.length !== now.length || filters.some((f, i) => now[i] !== f)) {
      drawn.slot.filters = filters;
    }
    this.drawBar(fighter, drawn);
    this.drawRing(fighter, drawn);
  }

  /**
   * How big a unit is drawn: twice its size while Age of Colossus lasts
   * (growing and shrinking over half a second), smaller and smaller as the
   * ground swallows it.
   */
  private sizeOf(fighter: Fighter): number {
    return this.grownSize(fighter) * (fighter.scale ?? 1);
  }

  private grownSize(fighter: Fighter): number {
    if (fighter.sinkingSince !== undefined) {
      return Math.max(0, 1 - (this.battle.frame - fighter.sinkingSince) / 15);
    }
    const until = Math.max(fighter.enlargedUntil ?? 0, fighter.grownUntil ?? 0);
    const frame = this.battle.frame;
    if (frame >= until) {
      return Math.max(1, 2 - (frame - until) / 15);
    }
    return Math.min(2, 1 + Math.max(0, frame - (fighter.grewAt ?? frame - 15)) / 15);
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

  /** What picture a fighter shows: its pose and way, or a special move's animation. */
  private keyOf(fighter: Fighter, pose: Pose, special: number): string {
    return !fighter.isUnit ? `b ${fighter.facing} ${fireStage(fighter.life, fighter.maxLife)} ${fighter.still ?? ""}`
      : special ? `s${special} ${fighter.facing} ${fighter.item.id}` : `${pose} ${fighter.facing} ${fighter.item.id}`;
  }

  /** The special animation a unit is playing (rules/specials.ts), or 0. */
  private specialOf(fighter: Fighter): number {
    const special = fighter.special;
    return special && !fighter.dead && this.battle.frame < special.until ? special.animation : 0;
  }

  private async paint(fighter: Fighter, drawn: Drawn, pose: Pose, special = 0): Promise<void> {
    const art = await this.art.get(fighter.item.art);
    if (drawn.slot.destroyed || drawn.key !== this.keyOf(fighter, pose, special)) {
      return;
    }
    drawn.slot.removeChildren().forEach((child) => child.destroy());
    const facing = unitFacing(fighter.facing);
    const moving = special && art ? art.numbered(special, facing.frame) : undefined;
    if (!art) {
      drawn.slot.addChild(outline(fighter));
    } else if (moving?.length) {
      // A special move: the animation the game numbers for it, played once from its start.
      const sprite = animated(moving, art.fps, true);
      if (facing.mirrored) {
        sprite.scale.x = -1;
      }
      sprite.position.set(fighter.at.x, fighter.at.y);
      drawn.slot.addChild(sprite);
    } else if (fighter.isUnit) {
      drawn.slot.addChild(unitSprite(art, fighter.facing, pose, fighter.at, pose === "MUERTE"));
    } else {
      const sprite = buildingSprite(art, asPlaced(fighter), this.skin, false, fighter.still);
      drawn.slot.addChild(sprite);
      // Losing life: the game's flames over it.
      const stage = fireStage(fighter.life, fighter.maxLife);
      if (stage > 0) {
        const fire = await fireSprite(stage);
        if (!drawn.slot.destroyed && drawn.key === this.keyOf(fighter, pose, special)) {
          fire.position.copyFrom(sprite.position);
          drawn.slot.addChild(fire);
        }
      }
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
      if ((!fighter.dead || fighter.ruined) && picture && isOpaqueAt(picture, screen)) {
        return fighter;
      }
    }
    let nearest: Fighter | null = null;
    let distance = Infinity;
    for (const [fighter, drawn] of slots) {
      const picture = drawn.slot.children[0];
      if (fighter.dead || !fighter.item.isUnit || !picture) continue;
      const d = unitHitDistance(picture.getBounds(), screen);
      if (d < distance) {
        nearest = fighter;
        distance = d;
      }
    }
    return nearest;
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

/** A filter that adds to the red, green and blue of every pixel (0 to 1). */
function brighter([r, g, b]: [number, number, number]): ColorMatrixFilter {
  const filter = new ColorMatrixFilter();
  filter.matrix = [1, 0, 0, 0, r, 0, 1, 0, 0, g, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
  return filter;
}
