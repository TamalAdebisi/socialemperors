# Quests and battles

This part of the original Flash client is the fighting. The `battle/` classes
are how a unit thinks in a fight (alone, as a boss, or as part of a raid or
siege) and how shots fly; the `quest/` classes are the islands sailed to from
the Quests window, the survival arena, and the troll camps that come to the
home town every 4 hours. The fighting itself (damage, reach, death) lives in
the map engine (see [engine.md](engine.md)); special moves are the delegates
(see [delegates.md](delegates.md)).

**Count:** 65 built, 10 partly, 16 not yet, 8 not needed (99 classes).

**How deep this was read.** Read through: every `battle/` class but
`TournamentIA` (its first half read, the rest by its parts), every projectile
class, `Quest`, `QuestInterface`, `QuestIslaTrolls1` (the other three by
comparing them with it), `QuestIslaCivilizacion` and its seven islands,
`QuestIslaHardGeneric` (the god islands by comparison) and all ten of their
small classes, `QuestBossYeti`, the two egg islands, `QuestShip` and
`QuestZeppelin`, `QuestSurvival` and `QuestSurvivalMap1` (the other four by
comparison). Skimmed: `QuestsInMap` (its shared parts and one camp builder
read; the others matched to `rules/camps.json` by name and by who calls
them), `CustomQuestNew` (its main flow), and `CustomQuest` and the camps'
own classes (their settings only). `QuestBossGolem`, `QuestBossWorm`,
`QuestBossDragon`, `QuestBossDragon2` and `QuestIslaHeroes` were only
checked here at the points below; their full reading is the earlier one
recorded in `client/src/rules/islands-notes.json`. Statuses come from
searching `client/src` and the server's `.py` files for the commands, ids
and rules each class uses.

**Words used here.** A "mind tick" is the unit's thinking, every 61 frames
(about 2 seconds at the game's 30 frames a second). "Lent" units are the
ones an island gives the player for the fight.

## How a unit thinks

| Class | Lines | What it does | Status |
|---|---|---|---|
| `battle/IA.as` | 542 | Every unit's mind. Its mood comes from its kind: villagers, farm animals, carts, healers, pets and the troll drummer run from danger (5 tiles towards the middle when hit); the kamikaze, the boat and the eagle never seek a fight; soldiers, bosses and the monk look for the nearest enemy within 10 tiles. A defensive unit more than 20 tiles from where it started walks back. Hit, it turns on the attacker if it had no target, its target can't fight, or the attacker is under half as far; idle allies near anything hit come to help. Healers mend the weakest hurt unit in reach, the engineer only siege engines. At home a wild farm animal goes to the player when one of their units comes near. Each mind tick the troll drummer speeds up the attacks of up to 10 nearby soldiers, healers and villagers of its side (see Surprises). | partly: `rules/battle.ts` (moods, help, fleeing, healers, engineer, monks), `rules/animals.ts` (catching animals); the drummer's aura and the units' speech are missing |
| `battle/IAWithAgro.as` | 242 | A boss's grudge list: each hit adds its damage to the grudge against the hitter (half again for the top one); the boss goes for the biggest grudge. With none, it takes the nearest enemy within 3 tiles until it has fought once, then the nearest anywhere. | built: `rules/bossMinds.ts` |
| `battle/BossIA.as` | 163 | The mind of a boss without its own class: always aggressive, never answers an ally's call. Sets the Stone Golem's and the Giant Yeti's life from the player's level (the golem's table has 1,900 at levels 15 to 19, a slip for 19,000), and the small golems' and yetis' life to 100 and 120. | built: `rules/battle.ts`, `rules/bosses.ts`, `rules/islands.json` (the 1,900 kept: DECISIONS.md) |
| `battle/IARockdriller.as` | 322 | The Mineral Isle's boss: 25,000 life, 22 every 20 frames; once it has fought, it burrows and comes up in turns of 15 seconds, sending up a Sanddriller each time it goes down; its shots leave slime; after 5 minutes it rages (100 every 5 frames). If its target is out of reach it goes home to the middle, whole again. A slime splash around each hit is written but switched off. | built: `rules/bossMinds.ts` |
| `battle/IASandDriller.as` | 60 | The Rockdriller's helper: 10,000 life (500 if a "hard" switch were off; it's on), 100 every 20 frames; dies if it stands in slime. | built: `rules/bossMinds.ts` |
| `battle/IADragon.as` | 369 | The Crimson Scale on the Nest Isle: fights 20 seconds, then flies a bombing run a star along the arena setting deadly fires, lands, and lays two eggs a star that hatch draggies, then fights again. | built: `rules/bossMinds.ts` |
| `battle/IAPet.as` | 60 | A pet (dog or cat): told to follow one of the player's villagers or soldiers, it keeps within 2 tiles of it; otherwise it idles. | not yet |
| `battle/IACartAlly.as` | 269 | The donkey cart that brings a neighbour's help: it drives to each building the neighbour helped, throws a box onto it (`assist_receive`, town and building), shows the share and the experience, then says goodbye and fades. | built: `editor.ts` (`welcomeCarts`), `rules/neighbours.ts`, `assists.py` |
| `battle/IASurvival.as` | 129 | A survival enemy's mind: it heads for the relic and attacks it, fighting back only when hit (a boss doesn't even then); once the relic falls it fights like any unit. | not yet (survival opens the classic game) |
| `battle/Squad.as` | 99 | Units sent together. When their target walks off, the ones out of reach (and archers closer than 3 tiles) follow it again, at most every 300 ms. | built: chasing a moving target re-plans every 300 ms in `rules/battle.ts`; groups aren't kept as such |
| `battle/Speech.as` | 109 | Short lines units say in a bubble: when they appear, kill, die, are hit, see a friend hit, finish a job, are told to move, are clicked too often, or now and then while idle (a unit idling turns about 1 time in 25 per mind tick, and speaks 1 time in 5 of those). The lines are written in the class, in English. | not yet |
| `battle/Maps.as` | 125 | The ground: one picture per block of 20 x 20 tiles, from the island's ground item and its table of block pictures; a sea block can't be walked. At home, the town's ground skin. | built: `rules/quest.ts` (`islandGround`), `view/battleView.ts`, `view/townView.ts` |

## Raids, sieges and battles against players

| Class | Lines | What it does | Status |
|---|---|---|---|
| `battle/collectiveai/AbstractCollectiveAI.as` | 106 | The shared base for a group mind: its units, where they came from, and steps on a timer. | built: `rules/raids.ts` (`Raid`) |
| `battle/collectiveai/CollectiveIA.as` | 1073 | Raids at home: a bandit band waits its minutes, then goes for buildings and units at random until it has burnt and killed its quota (1 to 4 each by level), then walks home; the village siege (engines, then two squads and the captain, a retreat after 2 minutes); the stampede and the army (whose targets depend on which blocks the player owns). Also four ways a town attacked by another player can defend (stay, half go out, ranged units against siege, everyone on the siege). | partly: the raids are built (`rules/raids.ts`, `homeDefence.ts`); the defence of a town attacked by a player is not yet |
| `battle/collectiveai/HeavySiegeCollectiveAI.as` | 249 | A siege of big dragons from the left edge (three sets, from levels 25, 35 and 45) that leaves after killing 10 units and 5 buildings, at most every 6 hours. | not needed: switched off in the game (`Config.HEAVY_SIEGE` is false) |
| `battle/CIA_QuestHelper.as` | 191 | Reinforcements for the Prisoner Princess camp: a window, enemies more than 10 tiles from the prison are removed, 9 Alliance Knights (576) are put down free in the far corner, walk to the town hall and join the player (see Surprises). | not yet |
| `battle/Assault.as` | 623 | Attacking another player: the army, the counters, the pay (a town hall pays the defender's level times 100; a fighter half its gold price, an eighth of its stone price or ten times its cash price, each capped; the defender gets a tenth of each attacker's loss), the share of units that come home by level, the spy eagle, and the `end_attack` report. | not yet (opens the classic game; `pvp.py` on the server) |
| `battle/TournamentIA.as` | 613 | The computer side in a tournament match: its army forms up, waits 10 seconds and advances; each unit takes the nearest enemy within its reach plus 2, else the weakest; healers go to whoever is hurt most; every 10 seconds anyone outside the middle 60 x 60 tiles is walked back in; the life bars and the end of the match. | not yet (opens the classic game; `tournaments.py` on the server) |

## Shots

| Class | Lines | What it does | Status |
|---|---|---|---|
| `battle/FXArrowAnimation.as` | 286 | The older kind of shot, still used by towers, the dragon's eggs and some special units: it flies at about 1,000 pixels a second in two arcs (straight for short shots and a long list of units), lands within a few pixels of its aim, and can be a beam that lasts a moment. | partly: shots fly and land in `rules/battle.ts`, drawn by `view/battleView.ts`; the straight flights and beams are drawn as arcs |
| `battle/projectiles/AbstractProjectile.as` | 190 | The base of the newer shots: its picture (cached as bitmaps), where it starts (with an optional random spread) and the signals for landing and finishing. | built: `Shot` in `rules/battle.ts` |
| `battle/projectiles/ParabolicProjectile.as` | 95 | The usual newer shot: steps at its speed towards a point a little off its aim, lifted in an arc by its curve, turned along its path. | built: `view/battleView.ts` (`placeShot`) |
| `battle/projectiles/ProjectileDefinition.as` | 216 | Each kind of shot: its picture, speed (arrows 30 pixels a frame, axes 20, rocks 18, cannonballs 40), curve, spread, landing puff and smoke trail. | built: `SHOT_FLIGHT` in `rules/battle.ts` |
| `battle/projectiles/Beam.as` | 78 | A ray stretched from shooter to target that lasts a set number of frames and hits on one of them. | partly: the moves that fire it hit (`rules/specials.ts`); the ray isn't drawn |
| `battle/projectiles/MovingBeam.as` | 74 | A ray that grows out and follows its target as it moves. | partly: as `Beam` |
| `battle/projectiles/BeamDefinition.as` | 41 | The rays' kinds: how long they last and when they hit. | partly: as `Beam` |
| `battle/projectiles/BeamBlast.as` | 24 | The flash at a ray's end. | not yet |
| `battle/projectiles/Blast.as` | 44 | The puff where a shot lands (earth for rocks and cannonballs); only a picture, it hurts nobody. | not yet |
| `battle/projectiles/Trail.as` | 17 | The smoke left behind rocks and cannonballs, a little darker or lighter at random. | not yet |
| `battle/projectiles/Machinegun.as` | 75 | A stream of extra shots every few frames while the shooter keeps its target; used by Castles I to III. | not yet: our castles fire one shot a beat (see delegates.md) |
| `battle/projectiles/DoubleSwordProjectile.as` | 25 | A shot drawn upright and spinning instead of turned along its path. | partly: the shot flies; its picture isn't held upright |
| `battle/projectiles/EightDirectionProjectile.as` | 64 | A shot whose picture is picked from eight directions (the orc kamikaze's). | partly: as above |
| `battle/projectiles/ZeroRotationProjectile.as` | 20 | A shot that is never turned (the necro tornado). | partly: as above |
| `battle/projectiles/Grenade.as` | 45 | A bouncing shot meant for a heavy rock. | not needed: nothing fires it |

## Quests: the shared parts

| Class | Lines | What it does | Status |
|---|---|---|---|
| `quest/Quest.as` | 769 | Picks the class for an island or a home camp; `start_quest` on Start; each kill's pay, capped by the island's gold and experience limits; experience cut to half the gold at the end; which fallen units come home (the island's share, rounded up, the lost ones picked at random by kind); `end_quest`. An island rests 4 hours after it's attacked. A boss's fall and an island chest drop a collection piece. A test switch can scale every reward; it's off unless the page asks for it. | partly: `rules/quest.ts`, `questPlay.ts`, `quests.py`; no collection pieces |
| `quest/QuestInterface.as` | 41 | What every island and camp class must answer: set-up, kills, collecting, the end, the ground, the landing tile, lent units and the share that comes home. | built: the `Island` shape in `rules/quest.ts` and `rules/islands.json` |

## The islands

The rules of each island, number by number, are in
`client/src/rules/islands-notes.json`; here only what each class is.

| Class | Lines | What it does | Status |
|---|---|---|---|
| `quest/QuestIslaTrolls1.as` | 352 | The Mysterious Isle: kill every enemy unit to light the chest; open it to win. Lends a High Elf. | built: `rules/quest.ts`, `rules/islands.json` |
| `quest/QuestIslaTrolls2.as` | 352 | The Unknown Isle, the same with Willy Wallace lent. | built: as above |
| `quest/QuestIslaTrolls3.as` | 354 | The Undiscovered Isle, the same with skeletons, Thor lent, kills paying half. | built: as above |
| `quest/QuestIslaTrolls4.as` | 357 | The Emergent Isle, the same with the Valkyrie lent and some of the island's walls and houses on the player's side. | built: as above |
| `quest/QuestIslaCivilizacion.as` | 338 | The civilization islands' base: destroy the town hall to win; kills pay a share (a quarter on most); 2 and 3 stars add copies of the enemy units (not farm animals). | built: as above |
| `quest/QuestIslaVikingo.as` | 50 | The Misty Isle, a civilization island. | built: as above |
| `quest/QuestIslaEgipto.as` | 50 | The Dune Isle, a civilization island. | built: as above |
| `quest/QuestIslaAztecas.as` | 50 | The Aztec Isle, a civilization island. | built: as above |
| `quest/QuestIslaChinos.as` | 45 | The Asian Isle, a civilization island. | built: as above |
| `quest/QuestIslaHumanos.as` | 50 | The Conquered Isle, a civilization island paying a tenth a kill. | built: as above |
| `quest/QuestIslaHumanos2.as` | 50 | The Civilizated Isle (the game's spelling), a civilization island. | built: as above |
| `quest/QuestIslaKamikazes.as` | 107 | The Wild Isle: every kamikaze and fire cannon on it is lent to the player; kills pay half. | built: as above |
| `quest/QuestIslaAtlantis.as` | 82 | The Mythical Isle, all sea ground, its walls and decorations nobody's. | built: as above |
| `quest/QuestIslaHeroes.as` | 372 | The Hero Isle: heroes in seven parts behind doors, each door opening once its part is beaten; kills pay a sixteenth. | built: `rules/quest.ts` (`doorZones`) |
| `quest/QuestIslaHardGeneric.as` | 367 | The hardcore islands' base: kill every enemy unit to win; higher gold cap; the island's prize for the stars. | built: `rules/quest.ts`, `rules/islands.json` |
| `quest/QuestIslaHard1.as` | 29 | Hardcore island 1: its ground and landing. | built: as above |
| `quest/QuestIslaHard2.as` | 21 | Hardcore island 2. | built: as above |
| `quest/QuestIslaHard3.as` | 21 | Hardcore island 3. | built: as above |
| `quest/QuestIslaHard4.as` | 21 | Hardcore island 4. | built: as above |
| `quest/QuestIslaHard5.as` | 21 | Hardcore island 5. | built: as above |
| `quest/QuestIslaHard6.as` | 29 | Hardcore island 6, sailed with a team of 20. | built: as above, teams in `rules/quest.ts` |
| `quest/QuestIslaHard7.as` | 24 | Hardcore island 7, sailed with a team of 20. | built: as above |
| `quest/QuestIslaGodGeneric.as` | 373 | The god islands' base: as the hardcore ones, with higher caps; the team must hold a god or colossus. | built: `rules/quest.ts` (`teamProblem`) |
| `quest/QuestIslaGod1.as` | 29 | God Isle 1. | built: as above |
| `quest/QuestIslaGod2.as` | 29 | God Isle 2. | built: as above |
| `quest/QuestIslaGod3.as` | 30 | God Isle 3, whose team needs 5 gods or colossi. | built: as above |

## The boss islands

| Class | Lines | What it does | Status |
|---|---|---|---|
| `quest/QuestBossYeti.as` | 522 | The Arctic Isle: guards in four groups, a key for each, three penguins joining the player per key, the gate, the Giant Yeti (two at 3 stars); a Powerful Knight or Battle Troll to storage on a win. | built: `rules/bosses.ts`, `rules/islands.json` |
| `quest/QuestBossGolem.as` | 473 | The Desert Isle: power gems by quarter, the altar, the Stone Golem appearing in its place; a Stone Golem to storage on a win. | built: as above |
| `quest/QuestBossWorm.as` | 500 | The Mineral Isle: four braziers, then the Rockdriller; archer knights or ravager trolls and a skull on a win. | built: as above, and `rules/bossMinds.ts` |
| `quest/QuestBossDragon.as` | 299 | The Nest Isle: break the egg, rocks close the way back, the Crimson Scale comes; only the prize pays. | built: as above |
| `quest/QuestBossDragon2.as` | 426 | The Dangerous Isle: two golden dragons guard a path, eight eggs each wound the black dragon, the eighth kills it. | built: as above |

## Old islands no player reaches

| Class | Lines | What it does | Status |
|---|---|---|---|
| `quest/QuestIslaEgg1.as` | 173 | An older Nest Isle: destroying the huge egg wins at once. Only Social Point's debug keys and admin panel open it. | not needed |
| `quest/QuestIslaEgg2.as` | 173 | An older Dangerous Isle, the same idea. Debug and admin only. | not needed |
| `quest/QuestShip.as` | 234 | The old sea map: the islands stood on it as buildings to click, and it wouldn't sail without a finished harbour. The Quests window replaced it; only the admin panel opens it. | not needed (our Quests window is `ui/islandMap.ts`) |
| `quest/QuestZeppelin.as` | 206 | The zeppelin's version of the same old map. Admin only. | not needed |

## Survival

| Class | Lines | What it does | Status |
|---|---|---|---|
| `quest/QuestSurvival.as` | 588 | The survival arena: the player's army guards a relic while waves come from eight points round the edge, every so many seconds, faster as it goes, with a boss wave between (two short waves of 5 while a boss lives, and a 5-second pause after it falls); the last stage never ends, with at most 80 enemies at once. Survival enemies can't be turned by monks, and bosses can't be frozen, swallowed or shocked. The relic's fall ends it; the prize is the unit for the longest stand passed. The clock counts only while the game isn't paused. | not yet (opens the classic game; `survival.py` on the server) |
| `quest/survival/QuestSurvivalMap1.as` | 103 | The first arena's waves: which units, how many, how often. | not yet |
| `quest/survival/QuestSurvivalMap2.as` | 103 | The second arena's waves. | not yet |
| `quest/survival/QuestSurvivalMap3.as` | 103 | The third arena's waves. | not yet |
| `quest/survival/QuestSurvivalMap4.as` | 103 | The fourth arena's waves. | not yet |
| `quest/survival/QuestSurvivalMap5.as` | 103 | The fifth arena's waves. | not yet |

## Troll camps at home

Thirty camps come one after another, 4 hours after the last chest was
opened. Ten are built by `QuestsInMap`; twenty are scripted stories in the
map's corners (CLIENT.md, "Troll camps" and "Scripted camps").

| Class | Lines | What it does | Status |
|---|---|---|---|
| `quest/QuestsInMap.as` | 5267 | Builds the ten code-made camps (walled squares and laid-out villages, made of the enemy race's things for the player's level, all saved with free `buy`), puts down a scripted camp's tiles, and opens a chest: the reward by level (nothing at exactly 26), `collect_treasure`, the next camp. Also seven camps only Social Point's admin panel can place, and a photo tool. | built: `rules/camps.ts`, `rules/camps.json`, `homeCamps.ts`; the admin-only camps not needed |
| `quest/CustomQuest.as` | 825 | The older scripted-camp engine: how far a camp has got is read from the keys, chest and wave still standing. | built: `rules/scripted.ts`, `homeScripted.ts` |
| `quest/CustomQuestNew.as` | 1007 | The newer engine: progress saved with `set_quest_var` (started, keys taken, bosses beaten, chest); each key guarded by the enemy units in a box round it (7 tiles back, 6 on); the camera visits the chest; helpers join and prizes come with the end. | built: `rules/scripted.ts`, `rules/scripted-camps.json`, `homeScripted.ts` |
| `quest/CustomQuest_01.as` | 139 | Camp 7, the mill: three keys, then the chest. | built: as above |
| `quest/CustomQuest_03.as` | 144 | Camp 9, the healers: four keys that are their own chests. | not needed: never reached; the game moves camp 9 on to 10 (`rules/camps.ts`) |
| `quest/CustomQuest_05.as` | 152 | Camp 11, the animals: the same shape. | not needed: never reached; moved on to 12 |
| `quest/CustomQuest_07.as` | 209 | Camp 13, the skeletons: three keys, then a wave of skeletons whose fall lights the chest. | built: as above |
| `quest/CQuestFireworks.as` | 204 | Camp 14, the fireworks festival: the chest fills a step per key. | built: as above |
| `quest/CustomQuest_GoldenGolem.as` | 263 | Camp 15, the golden golem: a boss, then the chest. | built: as above |
| `quest/CQuestVikingosCerveza.as` | 386 | Camp 16, the Viking beer festival: steps per key. | built: as above |
| `quest/CustomQuest_BlackYeti.as` | 105 | Camp 17, the black yeti: a boss, then the chest. | built: as above |
| `quest/CQuestAztecAltar.as` | 279 | Camp 18, the Aztec altar: steps per key. | built: as above |
| `quest/CustomQuest_GiantVyper.as` | 118 | Camp 19, the giant viper: a boss, then the chest. | built: as above |
| `quest/CQuestElfosArbol.as` | 332 | Camp 20, the elves' tree of life: steps per key. | built: as above |
| `quest/CustomQuestTheMummy.as` | 168 | Camp 21, the mummy: keys, then a boss, then the chest. | built: as above |
| `quest/CQuestAztecRockdriller.as` | 205 | Camp 22, the rockdriller's nest: keys, then a boss. | built: as above |
| `quest/CQuestChinosDragon.as` | 375 | Camp 23, the Chinese dragon: the village starts half burnt; the dragon gets away below a tenth of its life. | built: as above |
| `quest/CQuestNeptunoCleopatra.as` | 465 | Camp 24, Neptune and Cleopatra: two doors, each opened by its wave's fall; Neptune gets away. | built: as above |
| `quest/CQuestElfosEnt.as` | 337 | Camp 25, the corrupted Ent: it can't be hurt while its door stands. | built: as above |
| `quest/CQuestTesoroAtlante.as` | 271 | Camp 26, the Atlantean treasure: four keys end it. | built: as above |
| `quest/CQuestBalrog.as` | 90 | Camp 27, the Balrog: a boss and no chest. | built: as above |
| `quest/CQuestDemonPortal.as` | 90 | Camp 28, the demon portals: four keys end it. | built: as above |
| `quest/CQuestMagosCorruptos.as` | 86 | Camp 29, the corrupted wizards: four keys end it. | built: as above |

## Surprises

Rules found here that our notes (CLIENT.md, PARITY.md, DECISIONS.md and
`islands-notes.json`) don't mention, the most important first.

1. **Reinforcements for the Prisoner Princess, with no button**
   (`CIA_QuestHelper`). In a human town whose camp is the Prisoner Princess
   and that has no Alliance Knight yet, the game sends help: when the player
   reaches level 5, or when the town loads on the empire's first day below
   level 15. It removes every enemy unit more than 10 tiles from the prison
   (a `sell` each, reason "QUEST_HELP"), puts 9 Alliance Knights (576) down
   free in the far corner (a free `buy` each), and once they reach the town
   hall they're the player's. This changes the save, and our client does
   none of it.
2. **The troll drummer's aura** (`IA`). Each mind tick a troll drummer (604)
   makes up to 10 footmen, archers, riders, healers and villagers of its
   side within 10 tiles attack 10 frames sooner (never faster than every 10
   frames), drawn redder, until the next tick. `rules/battle.ts` treats the
   drummer only as a unit that runs from danger, so camps and raids with
   drummers fight slower than in the original.
3. **Survival costs no units.** `end_survival` carries only the arena, the
   time held and the prize. Units that fall in the arena are never reported,
   so they stay in the save (army units put on a battle map are marked as
   not saved, so their deaths send no `sell` either). The prize goes to
   storage when the results window is closed, and the time held counts only
   while the game isn't paused. Worth keeping when survival is built.
4. **Rockdriller "hard features"** (`IARockdriller`). Four switches; three
   are always on (the Sanddriller's 10,000 life comes from one), and one, a
   splash of slime that hurts the 8 tiles round each hit by 50, is off
   (`Constants.HORACIO_SAYS_NO` is false). We match the switched-off state.
5. **Pets follow their owner** (`IAPet`). Select a dog or cat and tap one of
   the player's villagers or soldiers: the pet then keeps within 2 tiles of
   it. Not in our client.
6. **Units talk** (`Speech`, `IA`). Bubbles with short English lines on
   appearing, killing, dying, being hit, finishing a job, being told to move,
   being clicked too often, and now and then while idle. Only a few units
   have lines. Changes nothing but the look.
7. **Player-battle defenders** (`IA`, `CollectiveIA`, `Assault`). The mind
   means an enemy soldier in a player battle to start defensive, but a slip
   makes every one aggressive; the town's chosen defence (by default "half
   go out") then sets each unit. For when player battles are built.
8. **Tournament matches** (`TournamentIA`). Healers there keep healing units
   at full life; every 10 seconds any unit outside the middle 60 x 60 tiles is
   walked back in; the computer side forms up and waits 10 seconds first.
9. **A reward switch** (`Quest`, `QuestsInMap`). A page setting
   (`abLessRewardQuestsChapters`) turns on a multiplier (0 to 2, from the
   config's `REWARD_QUESTS_CHAPTERS_MULTIPLIER`) on every island kill, island
   prize and camp chest. Our pages don't set it, so it stays off.
10. **The heavy siege is written but off** (`HeavySiegeCollectiveAI`): big
    dragons from level 25, three sets by level, at most every 6 hours,
    leaving after 10 units and 5 buildings. `Config.HEAVY_SIEGE` is false.
11. **The old sea map needed a harbour** (`QuestShip`): with no harbour, or one
    still being built, it refused to sail. Nothing reaches that map now; the
    Quests window doesn't make that check (CLIENT.md, "The harbour and the
    zeppelin").
