import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Battle, ENEMY, FPS, SELF } from "./battle.ts";
import { itemsById, type GameConfig, type ItemInfo } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import { Specials, type SpecialsTable } from "./specials.ts";
import { TournamentBattle, tournamentBout, tournamentPositions, tournamentScore, tournamentSpellAllowed, type TournamentScore } from "./tournamentBattle.ts";
import type { TournamentRoom } from "./tournaments.ts";

const config = JSON.parse(readFileSync(new URL("../../../config/game_config_20120826.json", import.meta.url), "utf8")) as GameConfig;
const sword = itemsById(config).get(643)!;
const unit = (fields: Partial<ItemInfo> = {}): ItemInfo => ({ ...sword, life: 100, defense: 0, attack: 10,
  attackInterval: 30, attackRange: 1, velocity: 4, ...fields });
const defaults: TournamentScore = { won: true, pointType: 1, playerSlots: 20, enemySlots: 20,
  playerLeft: 20, enemyLeft: 0, playerLife: 2000, enemyLife: 2000, playerDamage: 500, enemyDamage: 2000 };

function arena(weekly = false, player = [unit()], enemy = [unit()]) {
  const battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: () => 0.5, keepHealedTargets: true });
  const mine = player.map((item, i) => battle.add(item, 10, 59 - i * 2, SELF));
  const theirs = enemy.map((item, i) => battle.add(item, 90, 59 - i * 2, ENEMY));
  const match = new TournamentBattle(battle, mine, theirs, { weekly, pointType: 1, playerSlots: 20, enemySlots: 20 });
  const step = (frames: number) => {
    for (let i = 0; i < frames; i++) { battle.step(); match.step(); }
  };
  return { battle, mine, theirs, match, step };
}

test("tournament armies compact zero slots into the original two columns, capped at20", () => {
  const team = [0, ...Array.from({ length: 23 }, (_, i) => i + 1)];
  const mine = tournamentPositions(team, SELF);
  assert.equal(mine.length, 20);
  assert.deepEqual(mine[0], { id: 1, tile: { x: 10, y: 59 } });
  assert.deepEqual(mine[9], { id: 10, tile: { x: 10, y: 41 } });
  assert.deepEqual(mine[10], { id: 11, tile: { x: 14, y: 59 } });
  assert.deepEqual(tournamentPositions(team, ENEMY)[19], { id: 20, tile: { x: 86, y: 41 } });
  assert.deepEqual(team.slice(0, 3), [0, 1, 2], "placement never edits the saved team");
});

test("damage scoring preserves win/loss weights, overkill caps and the original zero-damage cases", () => {
  assert.equal(tournamentScore(defaults), 80);
  assert.equal(tournamentScore({ ...defaults, won: false }), 20);
  assert.equal(tournamentScore({ ...defaults, enemyDamage: 1000, won: false }), 10);
  assert.equal(tournamentScore({ ...defaults, playerDamage: 2500, enemyDamage: 4000 }), 0);
  assert.equal(tournamentScore({ ...defaults, playerDamage: 0, enemyDamage: 0 }), 100);
  assert.equal(tournamentScore({ ...defaults, playerDamage: 1, enemyDamage: 0 }), 0);
});

test("old survivor scoring counts the saved empty slots in its denominators", () => {
  assert.equal(tournamentScore({ ...defaults, pointType: 0, playerLeft: 2 }), 78);
  assert.equal(tournamentScore({ ...defaults, pointType: 0, won: false, playerLeft: 0, enemyLeft: 1 }), 24);
  assert.equal(tournamentScore({ ...defaults, pointType: 0, playerLeft: 20, enemyLeft: 0 }), 100);
});

test("only Crack and Black Hole are disabled in the tournament spell book", () => {
  assert.deepEqual(Array.from({ length: 20 }, (_, i) => i + 1).filter((id) => !tournamentSpellAllowed(id)), [7, 16]);
});

test("formation walks the armies inward; distant public defenders wait and regain their own speeds when hit", () => {
  const { battle, match, mine, theirs, step } = arena(false, [unit()], [unit({ velocity: 2 }), unit({ velocity: 6 })]);
  assert.equal(String(match.state), "ready");
  match.start();
  assert.deepEqual(theirs.map((f) => f.velocity), [2, 2]);
  for (let i = 0; i < 3000 && match.state === "forming"; i++) step(1);
  assert.equal(match.state, "waiting");
  assert.equal(mine[0].tx, 20);
  assert.deepEqual(theirs.map((f) => f.tx), [70, 70]);
  step(15 * FPS);
  assert.equal(match.state, "waiting");
  assert.equal(theirs[0].target, null);
  battle.hurt(theirs[0], 1, mine[0]);
  assert.equal(match.state, "fighting");
  assert.deepEqual(theirs.map((f) => f.velocity), [2, 6]);
  assert.ok(theirs.every((f) => f.target === mine[0]));
});

test("public defenders still use their ordinary defensive reactions when an enemy approaches", () => {
  const { battle, match, mine, theirs, step } = arena(false, [unit({ attack: 0, life: 1000 })], [unit({ attackRange: 4 })]);
  match.start();
  for (let i = 0; i < 2000 && match.state === "forming"; i++) step(1);
  battle.moveTo(mine, { x: 65, y: 59 });
  for (let i = 0; i < 2000 && mine[0].life === 1000; i++) step(1);
  assert.ok(mine[0].life < 1000, "the defender attacks without first being damaged");
  assert.equal(theirs[0].life, 100);
});

test("weekly defenders engage after ten game seconds following formation", () => {
  const { match, theirs, mine, step } = arena(true);
  match.start();
  for (let i = 0; i < 2000 && match.state === "forming"; i++) step(1);
  assert.equal(match.state, "waiting");
  step(10 * FPS - 1);
  assert.equal(match.state, "waiting");
  step(1);
  assert.equal(match.state, "fighting");
  assert.equal(theirs[0].target, mine[0]);
});

test("weekly engagement keeps the shared marching pace until a defender is hit", () => {
  const { battle, match, mine, theirs, step } = arena(true, [unit()], [unit({ velocity: 2 }), unit({ velocity: 6 })]);
  match.start();
  for (let i = 0; i < 3000 && match.state === "forming"; i++) step(1);
  step(10 * FPS);
  assert.equal(match.state, "fighting");
  assert.deepEqual(theirs.map((f) => f.velocity), [2, 2]);
  battle.hurt(theirs[0], 1, mine[0]);
  assert.deepEqual(theirs.map((f) => f.velocity), [2, 6]);
});

test("a hit breaks formation immediately and targets the nearest-range candidate in initial health order", () => {
  const { battle, match, mine, theirs } = arena(false, [unit({ life: 150 }), unit({ life: 50 })]);
  match.start();
  battle.hurt(theirs[0], 1, mine[0]);
  assert.equal(match.state, "fighting");
  assert.equal(theirs[0].target, mine[1], "outside reach, chase the initially weakest");
});

test("enemy healers keep a whole patient and switch to a more badly hurt defender", () => {
  const healer = unit({ id: 502, subcategory: 72, attack: 20, attackRange: 5 });
  const { battle, match, mine, theirs } = arena(false, [unit()], [unit(), unit(), healer]);
  match.start();
  battle.hurt(theirs[0], 1, mine[0]);
  assert.equal(theirs[2].target, theirs[0]);
  battle.heal(theirs[0], 1);
  match.step();
  assert.equal(theirs[2].target, theirs[0], "a whole patient remains assigned");
  battle.hurt(theirs[1], 40, mine[0]);
  assert.equal(theirs[2].target, theirs[1]);
});

test("collective healers initially follow a non-healer but can switch to an injured healer", () => {
  const ids = [502, 590, 866, 886];
  for (const injuredIndex of ids.keys()) {
    const healers = ids.map((id) => unit({ id, subcategory: 72, attackRange: 10, attackInterval: 15 }));
    const { battle, match, mine, theirs, step } = arena(true, [unit({ attack: 0 })], [...healers, unit({ attack: 0 })]);
    match.start();
    for (let i = 0; i < 2000 && match.state === "forming"; i++) step(1);
    assert.equal(match.state, "waiting");
    step(10 * FPS);
    assert.equal(match.state, "fighting");
    assert.ok(theirs.slice(0, 4).every((healer) => healer.target === theirs[4]),
      "the initial patient skips all four healers even when they come first in the army");

    const injured = theirs[injuredIndex];
    const helpers = theirs.slice(0, 4).filter((healer) => healer !== injured);
    battle.takeEvents();
    battle.hurt(injured, 50, mine[0]);
    assert.equal(injured.life, 50);
    assert.ok(helpers.every((healer) => healer.target === injured),
      `the other healers switch to injured healer ${injured.item.id}`);
    step(2 * FPS);
    assert.equal(injured.life, injured.maxLife, "normal healing beats restore the wounded healer");
    assert.ok(helpers.every((healer) => healer.target === injured), "the recovered patient remains assigned");
    const restored = battle.takeEvents().reduce((sum, event) =>
      sum + (event.kind === "hit" && event.heal && event.fighter === injured ? event.amount : 0), 0);
    assert.equal(restored, 50, "the retargeting produces real healing, not just a changed target");
  }
});

test("the tournament collective leaves engineers to repair friendly siege through ordinary healing beats", () => {
  const engineer = unit({ id: 570, subcategory: 72, attack: 25, attackRange: 5, attackInterval: 15 });
  const siege = unit({ id: 521, subcategory: 81, attack: 0 });
  const { battle, match, mine, theirs, step } = arena(false, [unit({ attack: 0 })], [siege, unit({ attack: 0 }), engineer]);
  match.start();
  battle.hurt(theirs[0], 10, mine[0]);
  theirs[1].life = 5;
  mine[0].life = 10;
  assert.equal(theirs[2].target, null, "collective combat orders do not send the engineer to the opposing army");
  step(120);
  assert.equal(theirs[2].target, theirs[0]);
  assert.equal(theirs[0].life, theirs[0].maxLife, "the engineer repairs its siege patient on real battle beats");
  assert.equal(theirs[1].life, 5, "the weaker non-siege defender is not an engineer patient");
  assert.equal(mine[0].life, 10, "the opposing army is never healed");
  assert.equal(match.state, "fighting");
});

test("both sides' tournament healers retain a whole patient; normal battles still release it", () => {
  for (const side of [SELF, ENEMY] as const) {
    for (const tournament of [true, false]) {
      const battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: () => 0.5,
        keepHealedTargets: tournament });
      const patient = battle.add(unit({ attack: 0 }), 50, 50, side);
      const healer = battle.add(unit({ id: 502, subcategory: 72, attackRange: 5 }), 51, 50, side);
      healer.target = patient;
      healer.attacking = true;
      for (let i = 0; i < 61; i++) battle.step();
      assert.equal(healer.target, tournament ? patient : null);
    }
  }
});

test("a retained whole tournament patient produces no healing events until it is hurt again", () => {
  for (const side of [SELF, ENEMY] as const) {
    for (const id of [502, 570, 590, 866, 886]) {
      const battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: () => 0.5,
        keepHealedTargets: true });
      const patient = battle.add(unit({ attack: 0, subcategory: id === 570 ? 81 : 78 }), 50, 50, side);
      const healer = battle.add(unit({ id, subcategory: 72, attackRange: 5, attackInterval: 15 }), 51, 50, side,
        { offset: 0 });
      const attempted: number[] = [];
      battle.onDealt = (_by, amount, healing) => { if (healing) attempted.push(amount); };
      healer.target = patient;
      healer.attacking = true;
      for (let i = 0; i < 120; i++) battle.step();
      assert.equal(healer.target, patient);
      assert.deepEqual(attempted, Array(8).fill(10), "whole-patient beats still report attempted healing for LIMIT");
      assert.equal(battle.takeEvents().some((event) => event.kind === "hit" && event.heal), false);
      patient.life -= 5;
      for (let i = 0; i < 120; i++) battle.step();
      assert.equal(patient.life, patient.maxLife);
      assert.equal(healer.target, patient, "the original target remains assigned after recovery");
      assert.deepEqual(attempted, Array(16).fill(10), `healer ${id} keeps the original attempted-healing amount`);
      const healing = battle.takeEvents().filter((event) => event.kind === "hit" && event.heal);
      assert.equal(healing.length, 1);
      assert.ok(healing[0].kind === "hit" && healing[0].amount === 5);
    }
  }
});

test("whole-patient healing fills the angel's LIMIT on its usual cadence without empty healing popups", async () => {
  const { default: table } = await import("./specials-table.json", { with: { type: "json" } });
  const battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: () => 0.5,
    keepHealedTargets: true });
  const specials = new Specials(battle, table as unknown as SpecialsTable, itemsById(config), () => 0.5);
  const patient = battle.add(unit({ attack: 0 }), 50, 50, SELF);
  const angel = battle.add(unit({ id: 886, attackRange: 5, attackInterval: 15 }), 51, 50, SELF, { offset: 0 });
  specials.buttons(angel);
  angel.target = patient;
  angel.attacking = true;
  for (let i = 0; i < 15; i++) { battle.step(); specials.step(); }
  assert.equal(angel.limit, 10, "the full patient still supplies attempted healing to LIMIT");
  for (let i = 0; i < 15; i++) { battle.step(); specials.step(); }
  assert.equal(angel.limit, 10, "a second beat inside the same second does not fill again");
  for (let i = 0; i < 15; i++) { battle.step(); specials.step(); }
  assert.equal(angel.limit, 20, "a later beat fills from the whole patient again");
  assert.equal(patient.life, patient.maxLife);
  assert.equal(battle.takeEvents().some((event) => event.kind === "hit" && event.heal), false);
  patient.life -= 5;
  for (let i = 0; i < 30; i++) { battle.step(); specials.step(); }
  assert.equal(patient.life, patient.maxLife);
  assert.equal(angel.limit, 30, "partial healing still counts the requested amount, never the smaller health gap");
  const healing = battle.takeEvents().filter((event) => event.kind === "hit" && event.heal);
  assert.equal(healing.length, 1);
  assert.ok(healing[0].kind === "hit" && healing[0].amount === 5);
});

test("damage healed later still lowers the score; summons cannot keep a beaten army in the match", () => {
  const { battle, match, mine, theirs } = arena();
  match.start();
  battle.hurt(mine[0], 20, theirs[0]);
  battle.heal(mine[0], 20);
  battle.add(unit(), 80, 80, ENEMY, { summoned: true });
  battle.hurt(theirs[0], 200, mine[0]);
  assert.deepEqual(match.result, { won: true, points: 84, surrendered: false });
  assert.equal(match.playerHealth, 1, "the bar shows healed health, unlike the score");
  assert.equal(match.enemyLeft, 0);
  assert.ok(battle.fighters.some((f) => f.side === ENEMY && !f.dead && f.summoned));
  battle.hurt(mine[0], 1000, null);
  assert.equal(match.result?.won, true, "a result is decided once");
});

test("original surviving units outside the middle are ordered back every ten seconds", () => {
  const { battle, match, mine, step } = arena();
  match.start();
  for (let i = 0; i < 2000 && match.state === "forming"; i++) step(1);
  battle.moveTo([mine[0]], { x: 5, y: 59 });
  step(20 * FPS);
  assert.ok(mine[0].tx >= 20 || mine[0].path.some((p) => p.x >= 20), "returned or walking inward");
});

test("surrender is zero points, records defeat once, and does not kill the copied army", () => {
  const { match, mine, theirs } = arena();
  match.start();
  match.surrender();
  const result = match.result;
  assert.deepEqual(result, { won: false, points: 0, surrendered: true });
  match.surrender();
  assert.equal(match.result, result);
  assert.ok([...mine, ...theirs].every((f) => !f.dead && f.life === 100));
});

test("the normal battle engine can win and lose a tournament without changing army definitions", () => {
  for (const strongPlayer of [true, false]) {
    const mine = unit({ attack: strongPlayer ? 100 : 5, life: strongPlayer ? 1000 : 50 });
    const foe = unit({ attack: strongPlayer ? 5 : 100, life: strongPlayer ? 50 : 1000 });
    const original = structuredClone([mine, foe]);
    const { battle, match, mine: players, theirs, step } = arena(true, [mine], [foe]);
    match.start();
    for (let i = 0; i < 10000 && !match.result; i++) {
      if (match.state === "waiting") battle.attackWith(players, theirs[0]);
      step(1);
    }
    assert.ok(match.result, "the armies meet and finish");
    assert.equal(match.result.won, strongPlayer);
    assert.ok(match.result.points >= 0 && match.result.points <= (strongPlayer ? 100 : 20));
    assert.deepEqual([mine, foe], original, "the home item definitions are untouched");
  }
});

test("only a ready, unfinished own match is playable; a started match can be reopened", () => {
  const match = { attacker_id: "me", victim_id: "foe", finished: false, attacker_won: false,
    attacker_points: 0, date_started: null, date_finished: null };
  const room: TournamentRoom = { tournament_id: "room", tournament_type_id: "1", reward_id: 0,
    private: "0", owner_id: "", owner: "", point_type: 1, date_ready: 0, date_finished: null, match_playing: false,
    players: [{ user_id: "me", user_name: "Me", level: 15, country: "", team: [643], abandonned: 0, matches: [match] },
      { user_id: "foe", user_name: "Foe", level: 15, country: "", team: [643], abandonned: 0, matches: [] }] };
  assert.ok(tournamentBout(room, "me", "foe"), "Unix zero is a valid ready date");
  assert.equal(tournamentBout(null, "me", "foe"), null);
  assert.equal(tournamentBout(room, "me", "me"), null);
  assert.equal(tournamentBout(room, "foe", "me"), null, "cannot play the opponent's match");
  assert.equal(tournamentBout({ ...room, date_ready: null }, "me", "foe"), null);
  assert.equal(tournamentBout({ ...room, date_finished: 100 }, "me", "foe"), null);
  room.players[0].abandonned = 1;
  assert.equal(tournamentBout(room, "me", "foe"), null);
  room.players[0].abandonned = 0;
  room.players[0].matches[0].date_started = 100;
  assert.ok(tournamentBout(room, "me", "foe"), "reopening uses the saved army and original start protocol");
  room.players[0].matches[0].finished = true;
  assert.equal(tournamentBout(room, "me", "foe"), null);
});
