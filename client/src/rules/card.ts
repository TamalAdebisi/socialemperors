// What the card for the thing selected shows (ui/actions.ts draws it), as
// the Flash client's info panel does for each kind of thing (our notes, our
// words: docs/original/index/interface.md, RecuadroInfo): which numbers
// stand by their pictures, the tip in the game's words, whether it shows
// what it earns with its time bar, and whether it shows who's inside. No
// drawing here.

import type { ItemInfo } from "./config.ts";
import { MOST_POPULATION } from "./training.ts";

/** The numbers the card can show, each by its picture: attack damage, the
 * time between hits (the hourglass), reach, walking speed, room for people. */
export type Stat = "attack" | "delay" | "range" | "speed" | "room";

/** A line of the game's words (config localization_strings): its id, what fills
 * its #0#, #1#..., and our English for when the config hasn't it. */
export interface Words {
  id: number;
  args?: (string | number)[];
  fallback: string;
  /** Words that follow on (the eagles' life after their tip). */
  then?: Words;
}

export interface CardFacts {
  stats: { stat: Stat; value: number }[];
  /** The tip, or null. For a building with room for units it shows only while nobody's inside. */
  tip: Words | null;
  /** What it earns, with its time bar (a farm, a mill, a wonder that works on its own). */
  earns: boolean;
  /** Who's inside, and how many fit. */
  inside: boolean;
  /** A tree or rock: what a villager's harvest of it brings. */
  harvest: boolean;
}

/** The tooltips over the numbers' pictures, in the game's words. */
export const STAT_WORDS: Record<Stat, Words> = {
  attack: { id: 301, fallback: "Attack Damage" },
  delay: { id: 302, fallback: "Attack Delay" },
  range: { id: 303, fallback: "Attack Range" },
  speed: { id: 304, fallback: "Unit Speed" },
  room: { id: 305, fallback: "Population Capacity" },
};

/** "CAPACITY 1/3": who's inside, out of how many fit. */
export const CAPACITY: Words = { id: 308, fallback: "CAPACITY #0#/#1#" };

/** The tip of a building with room for workers when its own isn't in the game's words: the panel's own. */
const PUT_WORKERS: Words = { id: 0, fallback: "Put peasants inside to produce resources" };

const SUB = {
  house: 111, mill: 121, farm: 122, ranch: 123, mine: 124, tree: 125, stone: 126, gold: 127, regrow: 128,
  blacksmith: 131, market: 132, church: 133, university: 134, townHall: 135, eagle: 136, healing: 137,
  collect: 138, feature: 139, tower: 211, wall: 221, door: 222, castle: 231, barracks: 311, archery: 321,
  stable: 331, workshop: 341, deco: 411, wonder: 511, treasure: 811, activator: 812, bossStatue: 813,
  relic: 814, heroes: 1211, refuge: 1311, domes: 1511, dragonKiller: 1711,
};

/** The Flash client's own numbers in the tips: a tenth off at the blacksmith and the university, two more trees in a line. */
const DISCOUNT_PERCENT = 10;
const LINE_MORE = 2;
const EAGLE_LIFE: Record<number, number> = { 185: 200, 349: 200, 186: 400, 350: 400, 187: 800, 351: 800, 217: 10000 };
const FORTRESS = 469;
const WAREHOUSE = 1284;
const GRAVEYARD = 486;
const NESTS = new Set([1233, 1255, 1394]);

/** The tips the game gives particular things, by item id. */
const TIPS: Record<number, Words> = {
  // Treasures and prisoners on the quest islands.
  82: { id: 259, fallback: "Defeat all enemies to open the Chest!" },
  83: { id: 260, fallback: "Defeat all enemies to rescue the Princess!" },
  84: { id: 261, fallback: "Defeat all enemies to rescue your Villagers!" },
  86: { id: 262, fallback: "Defeat all enemies to rescue the Rangers!" },
  87: { id: 263, fallback: "Defeat all enemies to liberate the Troll!" },
  90: { id: 264, fallback: "Defeat all enemies to rescue your Soldiers!" },
  85: { id: 265, fallback: "Defeat all enemies to rescue Prince Arthur!" },
  211: { id: 266, fallback: "Get water from the 3 Water Wells to extinguish the fire!" },
  237: { id: 267, fallback: "Defeat all enemies to rescue your Healers!" },
  238: { id: 268, fallback: "Defeat all enemies to rescue your Allies!" },
  257: { id: 269, fallback: "Defeat all enemies to rescue the siege machines!" },
  259: { id: 270, fallback: "A great skeleton statue." },
  // Things that open something there.
  88: { id: 271, fallback: "Defeat all nearby enemies to safely activate this device!" },
  146: { id: 272, fallback: "Defeat all nearby enemies to get the key and free the penguins!" },
  210: { id: 273, fallback: "Defeat all nearby enemies to get water from the well!" },
  236: { id: 274, fallback: "Defeat all nearby enemies to get the stone!" },
  256: { id: 275, fallback: "Defeat all nearby enemies to rescue the animals!" },
  258: { id: 276, fallback: "A mysterious skeleton statue" },
  89: { id: 277, fallback: "Put the 4 gems in the altar!" },
  147: { id: 278, fallback: "Get the 4 keys to open the door!" },
  // Buildings that change how the town works.
  223: { id: 287, fallback: "Your villagers are now trained to cut down trees very fast." },
  222: { id: 288, fallback: "Your villagers are now trained to mine gold and stone very fast." },
  221: { id: 289, args: [LINE_MORE], fallback: "Your villagers are now trained to run faster and to queue #0# additional resources." },
  325: { id: 289, args: [LINE_MORE], fallback: "Your villagers are now trained to run faster and to queue #0# additional resources." },
  366: { id: 290, fallback: "The statue increases your limit of 3 attacks per day to 4." },
  416: { id: 284, fallback: "" },
  224: { id: 285, fallback: "" },
  343: { id: 285, fallback: "" },
  299: { id: 286, fallback: "" },
  344: { id: 286, fallback: "" },
  1283: { id: 1177, fallback: "" },
};

/** The tips of buildings with room for animals or units, shown while nobody's inside. */
const INSIDE_TIPS: Record<number, Words> = {
  11: { id: 291, fallback: "Put sheeps inside to produce food" },
  190: { id: 291, fallback: "Put sheeps inside to produce food" },
  191: { id: 291, fallback: "Put sheeps inside to produce food" },
  12: { id: 292, fallback: "Put cows inside to produce food" },
  192: { id: 292, fallback: "Put cows inside to produce food" },
  193: { id: 292, fallback: "Put cows inside to produce food" },
  340: { id: 293, fallback: "Put boars inside to produce food" },
  341: { id: 293, fallback: "Put boars inside to produce food" },
  342: { id: 293, fallback: "Put boars inside to produce food" },
  227: { id: 294, fallback: "Put horses inside to allow soldiers to mount them" },
  219: { id: 296, fallback: "Provides you with food regularly" },
  230: { id: 295, fallback: "Provides you with population" },
  231: { id: 296, fallback: "Provides you with food regularly" },
  232: { id: 296, fallback: "Provides you with food regularly" },
  229: { id: 296, fallback: "Provides you with food regularly" },
  233: { id: 296, fallback: "Provides you with food regularly" },
  218: { id: 297, fallback: "Discovers a collectible item every day" },
  225: { id: 298, fallback: "Sacrifice a unit and obtain some resources back" },
  226: { id: 299, fallback: "Put a pair of the same animal to make them breed" },
};
/** The sacrifice altar shows no earnings, only its tip. */
const SACRIFICE = 225;

const fighting = (item: ItemInfo, ...more: Stat[]) => {
  const values: Record<Stat, number> = {
    attack: item.attack, delay: item.attackInterval, range: item.attackRange, speed: item.velocity, room: item.population,
  };
  return (["attack", "delay", ...more] as Stat[]).map((stat) => ({ stat, value: values[stat] }));
};

/** What the card shows for a thing (built: under construction it shows only its name and bar). */
export function cardFacts(item: ItemInfo): CardFacts {
  const none: CardFacts = { stats: [], tip: null, earns: false, inside: false, harvest: false };
  const s = item.subcategory;
  if (item.isUnit) {
    return { ...none, stats: [...fighting(item, "range", "speed")] };
  }
  if (TIPS[item.id] && (s === SUB.treasure || s === SUB.activator || s === SUB.bossStatue)) {
    return { ...none, tip: TIPS[item.id], harvest: s === SUB.treasure };
  }
  switch (s) {
    case SUB.tree:
    case SUB.stone:
    case SUB.gold:
      return { ...none, harvest: true, tip: { id: 257, fallback: "Select a villager and click this resource to harvest it" } };
    case SUB.regrow:
      return { ...none, tip: { id: 258, fallback: "Wait for the resource to regenerate" } };
    case SUB.house:
    case SUB.relic:
    case SUB.domes:
      return { ...none, stats: fighting(item, "room") };
    case SUB.deco:
      return { ...none, stats: fighting(item) };
    case SUB.eagle:
      return {
        ...none, stats: fighting(item),
        tip: { id: 279, fallback: "Now you can spy your enemies through the world explorer.\n",
          then: { id: 280, args: [EAGLE_LIFE[item.id] ?? 0], fallback: "Your eagles have #0# health." } },
      };
    case SUB.healing:
      return { ...none, stats: fighting(item), tip: { id: 281, fallback: "Heals nearby units when they are not in combat." } };
    case SUB.blacksmith:
      return { ...none, stats: fighting(item), tip: { id: 282, args: [DISCOUNT_PERCENT], fallback: "Allows you to reduce the cost of your footman, archers and mounted troops by #0#%." } };
    case SUB.university:
      return { ...none, stats: fighting(item), tip: { id: 283, args: [DISCOUNT_PERCENT], fallback: "Allows you to reduce the cost of producing siege engines by #0#%." } };
    case SUB.feature:
      return { ...none, stats: item.id === GRAVEYARD || NESTS.has(item.id) ? fighting(item, "range") : fighting(item), tip: TIPS[item.id] ?? null };
    case SUB.mill:
    case SUB.farm:
    case SUB.mine:
    case SUB.ranch:
    case SUB.collect:
      return { ...none, earns: item.id !== SACRIFICE, inside: item.capacity > 0, tip: INSIDE_TIPS[item.id] ?? PUT_WORKERS };
    case SUB.wall:
    case SUB.tower:
    case SUB.dragonKiller:
    case SUB.door:
      if (item.id === FORTRESS) {
        return { ...none, stats: fighting(item), inside: true, tip: { id: 300, fallback: "Put units inside to protect them from player assaults" } };
      }
      return { ...none, stats: fighting(item, "range") };
    case SUB.refuge:
      if (item.id === WAREHOUSE) {
        return none;
      }
      return { ...none, stats: fighting(item), inside: true, tip: { id: 300, fallback: "Put units inside to protect them from player assaults" } };
    case SUB.wonder:
      if (item.population > 0) {
        // The game's card left the line's blanks unfilled; filled here as its shop fills them.
        return { ...none, stats: fighting(item, "room"), tip: { id: 87, args: [MOST_POPULATION, item.population], fallback: "This wonder increases the #0# population limit by #1#" } };
      }
      return { ...none, earns: true };
    case SUB.townHall:
      return { ...none, stats: fighting(item, "range") };
    case SUB.castle:
      return { ...none, stats: fighting(item, "range") };
    case SUB.barracks:
    case SUB.archery:
    case SUB.stable:
    case SUB.workshop:
    case SUB.church:
    case SUB.market:
      return { ...none, stats: fighting(item) };
    case SUB.heroes:
      return { ...none, stats: fighting(item, "range") };
  }
  return none;
}

/** A line of words with its #0#, #1#... filled in. */
export function fill(text: string, args: (string | number)[] = []): string {
  return args.reduce<string>((line, arg, i) => line.replaceAll(`#${i}#`, String(arg)), text);
}
