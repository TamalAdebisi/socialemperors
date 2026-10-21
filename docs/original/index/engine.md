# The map engine, units, attacks and magic

This part of the original Flash client is the game board. It keeps every
building, unit, tree and rock on the isometric map, decides whose each one
is, runs their clocks (work, training, regrowth), and makes them walk,
fight, burn, heal and die, in town, on the islands and in defence. The
special units with buttons, their library of moves, and the spells all sit
on top of it; the windows and the server talk to the map through it.

**Count:** 107 built, 65 partly, 2 not yet, 8 not needed, 1 art (183 classes).

**How deep this was read.** `IsoEngine`, `IsoElement`,
`IsoInteractiveElement`, `IsoBuilding`, `IsoFightingElement` and
`IsoSpecialUnit` were read through; `IsoUnit` in its main parts (making a
unit, its update, attack, moves, what it can go into, its effects), the
rest skimmed. Every class in `core/attacks/` and `core/magic/` was read.
Of the 114 special units in `isounits/`, a handful were read in full (the
Taiji and Golden Dynasty dragons, the LIMIT base, the Ent's and the Greater
Demon's spells); the rest are described from our own notes on them
(`client/src/rules/specials.json`, an earlier read-through), and their
status comes from comparing those notes with the table our battles use
(`client/src/rules/specials-table.json`) and with `rules/specials.ts`.
A unit marked "built" has all its buttons and its LIMIT in our table; it
was not checked move by move against the original here.

**What the words mean here.** "Our table" is
`client/src/rules/specials-table.json`. "Left out" means our notes record
the effect but the table, and so our battles, don't do it. Flash event
classes that only carry a message between parts of the client are marked
"not needed": there is nothing in them to port.

## The map and its engine

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/isoengine/IsoEngine.as` | 4022 | The map's registry: every building and unit, who is the player's and who the enemy's, and the searches the rest of the game asks of it: the nearest enemy (things that can't fight count a little further off: 10 is added to their squared distance), the nearest free tile or free square, the ring of tiles a group attacking one target spreads round (longest range first), the villagers' speed and line by town hall, the gold-rock multiplier (x1 to x5 by level), the free harbour and zeppelin tower, the trolls' mercy check every 70 frames, and the counts goals ask for. Also: player attacks a day are 3, plus 1 with the Leadership Statue. | partly: the searches and rules are in `rules/battle.ts`, `walking.ts`, `villagers.ts`, `work.ts`, `dock.ts`, `raids.ts`; warehouse deployment/count rules in `rules/warehouse.ts`; missing eagles, allied market, unit collections, the attacks-a-day count |
| `core/isoengine/IsoElement.as` | 2409 | Anything on the map: its picture (or scaffolding while `build_time` runs), whose it is (by race; the wild ring's buildings are enemies, except farms, chests and scenery), its work clock (a tick a second; trees and rocks take about a second with the Forestry or Minery academy), collecting (harvest, workers' fifth, farm wood, the ranch's animal, a camp chest and its prisoners, the hatchery's copy, the allied market, a city quest), rocks growing back, friends' help pictures, moving and turning. | partly: collecting, regrowth and whose-things in `rules/production.ts`, `work.ts`, `nature.ts`, `camps.ts`; no hatchery, allied market or city quests (scaffolding and friends' help pictures are built); a farm short of wood is kept, not destroyed; idle state timelines and current-frame hover outlines are repaired in `view/buildingAnimation.ts` and `townView.ts` |
| `core/isoengine/IsoInteractiveElement.as` | 1012 | What a tap or hover does: selecting (golden ring, outline, life bar), the pointer (axe, pick, repair, inside, attack, catch), lining up trees and rocks for a villager, sending units into buildings or at enemies, helping a neighbour's building (10 gold, 3 XP), a double click selecting up to 20 units of the same kind within 10 tiles, and the hover bar with name and time. | partly: selection, original sword attack pointer, trimmed-frame unit click margins, villager lines and neighbour help in `view/selected.ts`, `editor.ts`, `rules/villagers.ts`, `rules/neighbours.ts`; the double click's group in `rules/group.ts` (`sameKindNear`; in battles ours picks the exact kind instead, `sameItem`, at the owner's request); no hover bar, lost-item window or pets |
| `core/isoengine/StatsModifier.as` | 15 | The shape of a multiplier on a fighter's attack and defence. | built: attack factors in `rules/battle.ts` |
| `core/isoengine/DefaultStatsModifier.as` | 38 | A plain attack and defence multiplier, used for Age of Colossus (attack x1.5). | built: `rules/magic.ts` (Age of Colossus) |
| `core/isoengine/UnitPopedEvent.as` | 22 | Flash event: a unit came out of a building. | not needed: Flash event plumbing |
| `core/isoengine/UnitPushedEvent.as` | 30 | Flash event: a unit went into a building (or was inside when the town loaded). | not needed: Flash event plumbing |
| `core/isoengine/events/ExtraEvent.as` | 22 | Flash event carrying an extra object. | not needed: Flash event plumbing |
| `core/isoengine/events/IsoDamageEvent.as` | 67 | Flash event: a fighter was hit (damage, life left, attacker). | not needed: Flash event plumbing |
| `core/isoengine/events/IsoElementEvent.as` | 22 | Flash event naming one map thing (repaired, trained, assisted...). | not needed: Flash event plumbing |

## Buildings

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/isoengine/IsoBuilding.as` | 1128 | A building: units inside (push and pop, with `push_unit`, `pop_unit`, `pop_sell`), training one unit at a time (blacksmith and university discounts, twice the price in food, population and `units_limit` checks), towers, castles and town halls from II shooting the nearest enemy and keeping it within half their range, healing springs, burning in four stages and villager repair (25 a time), the wall gate opening, and upgrading (sell, then buy the next one on the spot). | partly: inside, training, towers and burning in `rules/work.ts`, `training.ts`, `battle.ts`, `homeDefence.ts`; the wall gate in `editor.ts` and `rules/walking.ts`; oil/water tower pictures follow their target state; warehouse admission in `rules/work.ts`, `rules/warehouse.ts`; no tower-ring rule |

## Units and fighting

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/isoengine/IsoFightingElement.as` | 1270 | Anything that can fight or be hit: the damage formula (plus or minus 4, 1 in 10 critical, Ether Shield, defence, at least 1), siege half to units and units a quarter more to siege, the elements' bonus, domes, calling allies within 4 tiles, death and what it pays (enemy unit 5 gold and its experience; enemy tower 5 gold and experience only if priced in stone), burying the player's fallen (`sell` ... KILL), `kill` for enemies, and timed freeze and electrocution. | partly: in `rules/battle.ts`, `graveyard.ts`, `homeDefence.ts`; no domes; at home a unit with no attack pays nothing in ours, and towers pay experience whatever they cost |
| `core/isoengine/IsoUnit.as` | 4456 | A unit: walking (A* paths, flying), its mind every 61 frames and attack check every 5, ranged shots and their projectiles, the automatic specials of heroes and elite units, villagers chopping, mining and repairing, going into buildings, catching animals, being thrown, stunned, poisoned, burnt, frozen, swallowed, turned, grown or turned to stone, the kamikaze's blast, speech bubbles, ships and eagles. | partly: walking in `rules/walking.ts`, fighting in `rules/battle.ts` and `specials.ts`, work in `rules/work.ts`; its picture by animation number (frame 5a + way, never the label) in `ItemArt.pose`; no speech bubbles, pets, ships or spy eagles, squad re-forming |
| `core/isoengine/IsoSpecialUnit.as` | 880 | A unit with buttons: idle, casting and cooldown on a one-second timer (any button waits for the others, the LIMIT slot doesn't), eggs laid 4 to 8 tiles ahead with at most 3 minions alive, turning into another unit for a while, and teleporting instead of walking for a few dragons. Holds code for special units expiring 24 hours after birth that nothing calls. | partly: buttons, cooldowns, eggs and transforms in `rules/specials.ts`, `ui/specialButtons.ts`; no teleport |
| `core/isoengine/isounits/IsoLimitUnit.as` | 72 | The base of units with a LIMIT bar: the LIMIT button works only with the bar full, and empties it when the move ends. | built: `rules/specials.ts` |
| `core/isoengine/isounits/limits/LimitColorDefinition.as` | 24 | The colours of the LIMIT bar and its text. | art |

## Special units: dragons

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/isoengine/isounits/IsoBahamutPaladin.as` | 131 | Paladin Bahamut Dragon (2000, 2002): 4 buttons and a LIMIT (lightning). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoBahamutSupreme.as` | 148 | Supreme Bahamut Dragon (2003): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoBlackBahamutDragon.as` | 171 | Black Bahamut Dragon (891, 893): 4 buttons and a LIMIT (smash). | partly: whirlwind's swallowing of small units left out |
| `core/isoengine/isounits/IsoBlackDragon.as` | 393 | Black Dragon (723, 837): 3 buttons and a LIMIT (lightning). | partly: Ground Quake's burn left out |
| `core/isoengine/isounits/IsoBlackEpicDragon.as` | 174 | Black Epic Dragon (2199, 2201): 4 buttons and a LIMIT (smash). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoCelestialDragon.as` | 31 | Angelical Dragon (793, 843): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoCrystalDragon.as` | 246 | Crystal Dragon (777, 841): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoDoubleHeadDragon.as` | 24 | Two-Headed Dragon Rider (836): a LIMIT (smash). Only sets up the LIMIT smash; its beams come from its delegate. | partly: its burn and freeze beams aren't built |
| `core/isoengine/isounits/IsoDoubleHeadDragon2.as` | 170 | Epic 2-Head Dragon (736, 838): 2 buttons and a LIMIT (lightning). | partly: its electrocuting beams aren't built |
| `core/isoengine/isounits/IsoDualGodsDragon.as` | 155 | 2-Head Holydeath Dragon (2043, 2045): 4 buttons and a LIMIT (lightning). | partly: beam cycle and the whirlwind's healing of small allies left out |
| `core/isoengine/isounits/IsoEgyptianDragon.as` | 163 | Pharaoh Bahamut Dragon (888, 889): 4 buttons and a LIMIT (lightning). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoElectricBahamutDragon.as` | 86 | Electric Bahamut Dragon (862, 864): 4 buttons and a LIMIT (smash). | partly: electrocution left out |
| `core/isoengine/isounits/IsoElectricEpicDragon.as` | 205 | Electric Epic Dragon (2202, 2204): 4 buttons and a LIMIT (smash). | partly: electrocution left out |
| `core/isoengine/isounits/IsoExtremeBullDragon.as` | 178 | Bull Extreme Dragon (2180, 2182): 4 buttons and a LIMIT (smash). | partly: freeze left out |
| `core/isoengine/isounits/IsoExtremeElectricDragon.as` | 144 | Electric Extreme Dragon (2171, 2173): 4 buttons and a LIMIT (lightning). | partly: electrocution left out |
| `core/isoengine/isounits/IsoExtremeFireDragon.as` | 114 | Fire Extreme Dragon (2177, 2179): 4 buttons and a LIMIT (lightning). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoExtremeForestDragon.as` | 327 | Forest Extreme Dragon (2186, 2188): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoExtremeFrostDragon.as` | 212 | Frost Extreme Dragon (2183, 2185): 4 buttons and a LIMIT (smash). | partly: freeze left out |
| `core/isoengine/isounits/IsoExtremeGoldenDragon.as` | 127 | Golden Extreme Dragon (2174, 2176): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoExtremeSoulDragon.as` | 131 | Soul Extreme Dragon (2193, 2195): 4 buttons and a LIMIT (lightning). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoExtremeWindDragon.as` | 169 | Wind Extreme Dragon (2190, 2192): 4 buttons and a LIMIT (smash). | partly: every sixth unit flung and killed: left out |
| `core/isoengine/isounits/IsoFourWingDragon.as` | 187 | Green Extreme Dragon (2140, 2142): 4 buttons and a LIMIT of its own. | partly: burn and poison left out |
| `core/isoengine/isounits/IsoFrostFireDragonDelegate.as` | 171 | 2-Head Frostfire Dragon (2023, 2026): 4 buttons and a LIMIT (healing). | partly: burn and freeze beams left out |
| `core/isoengine/isounits/IsoFuriousBullDragon.as` | 347 | Furious Bull Dragon (785, 842): 4 buttons and a LIMIT (smash). | partly: electrocution left out |
| `core/isoengine/isounits/IsoFuriousRedDragon.as` | 24 | Furious Dragon Rider (832): a LIMIT (lightning). No buttons; uses the Furious Dragon's automatic moves. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGalaxyDragon.as` | 110 | Galaxy Dragon (2048, 2050): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGoldenBahamutDragon.as` | 162 | Golden Bahamut Dragon (875, 877): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGoldenDragon.as` | 362 | Golden Dragon (708, 835): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGoldenDynastyDragon.as` | 190 | Golden Dynasty Dragon (2069, 2071): 4 buttons and a LIMIT (lightning). Its whirlwind turns small enemies into gold statues (10 gold each, `gold_statue_conversion`); its horn kills units of 500 life or less; teleports. | partly: no gold statues, horn kill or teleport |
| `core/isoengine/isounits/IsoGoldenEpicDragon.as` | 309 | Golden Epic Dragon (2196, 2198): 4 buttons and a LIMIT (lightning). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGreenBahamutDragon.as` | 102 | Green Bahamut Dragon (846, 852): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoHellDragon.as` | 199 | Hell Abyss Dragon (2129, 2131): 4 buttons and a LIMIT (lightning). | partly: burns left out |
| `core/isoengine/isounits/IsoInfernalDragon.as` | 24 | Infernal Dragon Rider (839): a LIMIT (lightning). No buttons; its normal attack picks a tail swipe or a fire breath by distance. | partly: fights as a plain unit; its swipe and breath not built |
| `core/isoengine/isounits/IsoJewelEpicDragon.as` | 63 | Jewel Epic Dragon (2205, 2207): 4 buttons and a LIMIT (lightning). | partly: dizziness after its whirlwind left out |
| `core/isoengine/isounits/IsoLightDragon.as` | 397 | Sayan Dragon (695, 834): 4 buttons and a LIMIT (smash). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoLightingDragon.as` | 24 | Stormy Dragon Rider (833): a LIMIT (smash). No buttons; uses the Stormy Dragon's automatic moves. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoNecroDragon.as` | 214 | Death Dragon (826, 845): 4 buttons and a LIMIT (smash). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoNeonEpicDragon.as` | 50 | Neon Epic Dragon (2211, 2213): 4 buttons and a LIMIT (healing). | partly: dizziness after its moves left out |
| `core/isoengine/isounits/IsoPunk.as` | 366 | Heavy Dragon (766, 840): 3 buttons and a LIMIT (smash). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoRainbowDragon.as` | 67 | Rainbow Dragon (2037, 2038): 4 buttons and a LIMIT (lightning). Becomes another dragon for 20 seconds; teleports when sent somewhere. | partly: no teleport |
| `core/isoengine/isounits/IsoRedBahamutDragon.as` | 161 | Red Bahamut Dragon (853, 855): 4 buttons and a LIMIT (lightning). | partly: burn left out |
| `core/isoengine/isounits/IsoRedHotEpicDragon.as` | 63 | Red Hot Epic Dragon (2208, 2210): 4 buttons and a LIMIT (lightning). | partly: the whirlwind's burn left out |
| `core/isoengine/isounits/IsoRubiesDragon.as` | 231 | Rubies Dragon (798, 844): 4 buttons and a LIMIT (lightning). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoShogunEpicDragon.as` | 55 | Shogun Epic Dragon (2217, 2219): 4 buttons and a LIMIT (smash). | partly: dizziness after its moves left out |
| `core/isoengine/isounits/IsoSkullEpicDragon.as` | 62 | Skull Epic Dragon (2214, 2216): 4 buttons and a LIMIT (smash). | partly: dizziness after its whirlwind left out |
| `core/isoengine/isounits/IsoSkyBahamutDragon.as` | 86 | Sky Bahamut Dragon (2121, 2123): 4 buttons and a LIMIT (smash). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoSnakeDragon.as` | 115 | Dynasty Dragon (2013, 2015): 4 buttons and a LIMIT (lightning). Teleports when sent somewhere. | partly: no teleport; poison left out |
| `core/isoengine/isounits/IsoSnakeDragonElec.as` | 161 | Electric Dynasty Dragon (2016, 2018): 4 buttons and a LIMIT (lightning). Teleports when sent somewhere. | partly: no teleport; electrocution left out |
| `core/isoengine/isounits/IsoStarDragon.as` | 120 | Star Dragon (2063, 2065): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoSunDragon.as` | 137 | Solar Dragon (2039, 2041): 4 buttons and a LIMIT (smash). | partly: burn left out |
| `core/isoengine/isounits/IsoTaijiEpicDragon.as` | 63 | Taiji Epic Dragon (2220, 2222): 4 buttons and a LIMIT (lightning). Its whirlwind takes only units under 500 life left, drains them, then drops them for 900. | partly: whirlwind hits any unit for 900; drain and dizziness left out |
| `core/isoengine/isounits/IsoThreeHeadElementalDragon.as` | 210 | 3-Head Primal Dragon (2132, 2134): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoThreeHeadedDragon.as` | 146 | 3-Head Dragon (2057, 2058): 4 buttons and a LIMIT (smash). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoVulcanoDragon.as` | 86 | Vulcano Dragon (847, 851): 4 buttons and a LIMIT (lightning). | partly: burn left out |

## Special units: gods, colossi and other giants

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/isoengine/isounits/IsoAres.as` | 264 | Ares (788): 4 buttons. | partly: the bubble's burn left out |
| `core/isoengine/isounits/IsoColossusElementalWater.as` | 164 | Elemental Water Colossus (2086): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoColossusFire.as` | 168 | Elemental Fire Colossus (2077): 4 buttons and a LIMIT of its own. | partly: burns left out |
| `core/isoengine/isounits/IsoColossusForest.as` | 230 | Elemental Forest Colossus (2080): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoColossusGenesisEarth.as` | 76 | Genesis Earth Colossus (2152): 2 buttons. | partly: stone on landing left out |
| `core/isoengine/isounits/IsoColossusHeaven.as` | 147 | Elemental Light Colossus (2094): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGodElementalEarth.as` | 235 | Genesis Earth God (2148): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGodElementalEvil.as` | 203 | Dark Evil God (2113): 4 buttons and a LIMIT of its own. | partly: Mega Slash's kill (1000 life or less) left out |
| `core/isoengine/isounits/IsoGodElementalForest.as` | 227 | Elemental Forest God (2079): 4 buttons and a LIMIT (healing). | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGodElementalRed.as` | 186 | Elemental Fire God (2075): 4 buttons and a LIMIT of its own. | partly: burn left out |
| `core/isoengine/isounits/IsoGodElementalSoul.as` | 381 | Elemental Soul God (2089): 4 buttons and a LIMIT of its own. | partly: Mega Slash's kill and the freeze left out |
| `core/isoengine/isounits/IsoGodElementalWater.as` | 218 | Elemental Water God (2085): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGodGenesisIce.as` | 150 | Genesis Ice God (2167): 4 buttons and a LIMIT of its own. | partly: freeze left out |
| `core/isoengine/isounits/IsoGodGenesisIron.as` | 156 | Genesis Iron God (2169): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGodGenesisShadow.as` | 232 | Genesis Shadow God (2160): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGodGenesisWind.as` | 184 | Genesis Wind God (2156): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGodPoseidon.as` | 327 | Poseidon (773): 3 buttons. Its normal attack only hurts within 2 tiles. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGodZeus.as` | 269 | God Zeus (778, 828): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoHades.as` | 214 | Hades (765): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoHeaven.as` | 185 | Elemental Light God (2093): 4 buttons and a LIMIT of its own. At range its normal ray throws the unit hit 5 tiles. | partly: the ray's throw left out |
| `core/isoengine/isounits/IsoHefesto.as` | 259 | Vulcan (Hefesto) (781): 3 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoInfraworldCollosus.as` | 24 | Elemental Soul Colossus (2090): 4 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoNeptune.as` | 284 | Neptune (623): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoRhodasColossus.as` | 320 | Rodas Colossus (764): 4 buttons. | partly: electrocution and burn left out |

## Special units: heroes, gladiators and the rest

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/isoengine/isounits/IsoAngelicalSuperHealer.as` | 26 | Megahealing Angel (886): a LIMIT of its own. A healer whose hits heal; its LIMIT fills from healing. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoAntimatterGolem.as` | 73 | Antimatter Golem (2098, 2111): 2 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoArcangel.as` | 262 | Celestial Supreme (711): 4 buttons. | partly: burns left out |
| `core/isoengine/isounits/IsoBigLure.as` | 53 | Luring Warrior (2087): 1 button. Draws enemies to fight it; every 6th hit is a spin. | partly: the spin every 6th hit not built |
| `core/isoengine/isounits/IsoCaesarGladiator.as` | 154 | Caesar Gladiator (2157): 3 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoChamaleon.as` | 57 | Chameleon (896): 1 button. Takes its target's form for 30 seconds. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoChariotGladiator.as` | 68 | Chariot Gladiator (2151): 1 button. Never targets anything: it hurts only by driving through enemies. | partly: its driving hits aren't built |
| `core/isoengine/isounits/IsoChimera.as` | 175 | Chimera (787): 3 buttons. | partly: freeze and poison left out |
| `core/isoengine/isounits/IsoConan.as` | 297 | Barbarian (661): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoDragonHunter.as` | 45 | Dragon Hunter (872): 2 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoDragonHunter2.as` | 47 | Dragon Hunter II (873): 3 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoElfBullRiderDelegate.as` | 63 | Red Bull Rider (2019). No buttons: tramples enemies within 2 tiles while walking, and grabs small ones every few hits. | partly: fights as a plain unit; trampling and grabs not built |
| `core/isoengine/isounits/IsoElfSilverPaladin.as` | 62 | Silver Paladin (2020): 2 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoEnt.as` | 317 | Ent (635): 4 buttons. Casts the Stone Rain and Sacred Rain spells round itself. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoFireSoulEater.as` | 48 | Fire Soul Eater (2081): 2 buttons. Starts small and grows with each soul it takes, its attack rising with its size. | partly: souls and growth not built |
| `core/isoengine/isounits/IsoGoldenPaladin.as` | 195 | Golden Paladin (2036): 2 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoGreaterDemon.as` | 342 | Demon Crusher (654): 4 buttons. Makes a Fire Rain spell object it never casts. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoInvisibleKiller.as` | 68 | Invisible Killer (2067): 1 button. Can't be targeted for a while; every 6th hit is a knife spin. | partly: the knife spin every 6th hit not built |
| `core/isoengine/isounits/IsoLeonidas.as` | 260 | Spartan Champion (660): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoManticora.as` | 196 | Manticora (786): 4 buttons. | partly: poison left out |
| `core/isoengine/isounits/IsoMedievalEtherMessiah.as` | 238 | Medieval Ether Messiah (2101): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoMedievalGoldenSlayer.as` | 26 | Medieval Golden Slayer (2099): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoMedievalSamurai.as` | 149 | Medieval Samurai (2102): 4 buttons. | partly: Mega Slash's kill and freeze on landing left out |
| `core/isoengine/isounits/IsoMinotaurGladiator.as` | 169 | Minotaur Gladiator (2144): 2 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoMonsterGladiator.as` | 63 | Lizard Gladiator (2109): 2 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoMonsterHunter.as` | 28 | Monster Hunter (894): 2 buttons and a LIMIT of its own. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoMotherMonster.as` | 35 | Queen Beast (2127): 1 button. Its spit poisons; every 5th hit is a volley of six. | partly: poison spit and volley not built |
| `core/isoengine/isounits/IsoMuerte.as` | 97 | Grim Reaper (715): 1 button. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoMummy.as` | 337 | Mummy (615, 669): 4 buttons. Holds code to expire after 24 hours and sell itself that nothing calls. | partly: the oil's burn left out |
| `core/isoengine/isounits/IsoOrcBoomerang.as` | 115 | Boomerang Orc (2068): 1 button. Every 5th hit at range is a jump that throws everyone within 4 tiles. | partly: the jump every 5th hit not built |
| `core/isoengine/isounits/IsoOrcSpectrum.as` | 97 | Wyvern Rider (2062): 2 buttons. | partly: burn left out |
| `core/isoengine/isounits/IsoPriestGladiator.as` | 65 | Priest Gladiator (2117): 1 button. Every 7th hit is a rain of 25 drops round its target. | partly: the rain every 7th hit not built |
| `core/isoengine/isounits/IsoSamurai.as` | 334 | Red Samurai (694): 4 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoScarabRider.as` | 28 | Scarab Rider (897): 3 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoSpikySpider.as` | 149 | Spiky Spider (782): 3 buttons. | built: `rules/specials-table.json` |
| `core/isoengine/isounits/IsoSwapMonster.as` | 209 | Swamp Monster (2137): 3 buttons. | built: `rules/specials-table.json` |

## The special-moves library

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/attacks/AbstractDamage.as` | 36 | Base of the damages the library's moves apply to each unit they catch. | built: move kinds in `rules/specials.ts` |
| `core/attacks/AbstractSpecialAttack.as` | 62 | Base of the library's moves; a move can share its damage between the units it catches. | built: `rules/specials.ts` (shared drops) |
| `core/attacks/AbstractSpecialAttackCreator.as` | 20 | Base of the library's move makers. | built: `rules/specials-table.json` |
| `core/attacks/SpecialUnitAttackCreator.as` | 86 | Describes one button: uses (unlimited), cast time, cooldown (24 seconds unless set), name, picture, the 'can't' message and its check. | built: `rules/specials.ts`, `ui/specialButtons.ts` |
| `core/attacks/UnitFilters.as` | 61 | Filters for moves: fighting units under or over a life. A third filter, for a life between two numbers, can never match; nothing uses it. | partly: the Taiji dragon's under-500 filter isn't in our table |
| `core/attacks/damages/AnimationDummyDamage.as` | 92 | Plays an effect on a unit for some seconds, then lets the next step of a sequence go. | built: timings in `rules/specials.ts` |
| `core/attacks/damages/AttractDamage.as` | 131 | Pulls a unit to the attacker, drains its life in ticks (healing the attacker), then drops it back. | not yet: the Taiji dragon's drain |
| `core/attacks/damages/DirectKillDamage.as` | 61 | Kills a unit outright, only if its life is at or under a limit when one is given. | built: the skull seal in `rules/specials.ts` |
| `core/attacks/damages/DizzyDamage.as` | 29 | Leaves a unit helpless with stars, taking damage in ticks. | not yet: the epic dragons' dizziness |
| `core/attacks/damages/HealthDamage.as` | 25 | Heals a unit by a fixed amount. | built: `heal` moves in `rules/specials.ts` |
| `core/attacks/damages/IncinerateDamage.as` | 45 | Sets a unit burning: damage every tick for a number of ticks. | partly: burning only in the ghost move |
| `core/attacks/damages/PushInAirDamage.as` | 43 | Hits a unit and throws it some tiles. | built: `rules/specials.ts` |
| `core/attacks/damages/RandomizedFactorDamage.as` | 66 | Picks one of several damages at random, by weight. | built: the skull seal's chance to kill |
| `core/attacks/damages/SequencedDamage.as` | 66 | Applies damages one after another to the same unit (thrown, then dizzy...). | partly: the later steps are mostly left out |
| `core/attacks/damages/SimpleDamage.as` | 74 | Leaves a unit helpless for some seconds, hurting it in equal ticks. | partly: only as plain helplessness |
| `core/attacks/specialCreators/AreaDamageSpecialAttackCreator.as` | 38 | Makes an area move round the unit itself. | built: `rules/specials.ts` |
| `core/attacks/specials/AbstractAreaSpecialAttack.as` | 100 | An area move: at given frames of an animation, a damage on up to N units within a range of one or more points. | built: `whirl` and `blast` moves |
| `core/attacks/specials/AreaDamageSpecialAttack.as` | 21 | An area move centred on the unit itself. | built: `rules/specials.ts` |
| `core/attacks/specials/EnergyBallsSpecialAttack.as` | 121 | Shoots projectiles at given frames of an animation, at the target or scattered ahead. | built: `volley` moves |
| `core/attacks/specials/GhostSpecialAttack.as` | 158 | Ghost copies of the unit appear round it, each doing a move, then vanish. | built: `ghosts` moves |
| `core/attacks/specials/HealthAreaSpecialAttack.as` | 94 | A healing seal under each own unit in range; each seal heals every own unit in range, so the healing stacks with the number of units. | partly: ours heals each unit once |
| `core/attacks/specials/RainSpecialAttack.as` | 75 | A rain of hits on random tiles round the target for some seconds; units only. | built: `storm` moves |
| `core/attacks/specials/RegularAreaMultiBeamSpecialAttack.as` | 116 | Beams at the nearest enemy units in range, the rest at evenly spread tiles, sharing a damage. | built: as a volley in our table |
| `core/attacks/specials/SealAreaSpecialAttack.as` | 176 | A seal over the enemies: they float up helpless, are hurt, then dropped. | built: `lift` moves |
| `core/attacks/specials/SelfHealingSpecialAttack.as` | 35 | The unit heals itself by a fixed amount. | built: `heal` moves |
| `core/attacks/specials/SpawnMinionSpecialAttack.as` | 28 | Brings minions, with a most-alive limit. | built: `spawn` moves |
| `core/attacks/specials/WaypointAreaSpecialAttack.as` | 102 | An area move at points marked in the unit's drawing (or a random tile in range). | built: approximated round the target |
| `core/attacks/specials/WhirlwindSpecialAttack.as` | 67 | A whirlwind: every few frames for some seconds, a damage on up to N units in range, optionally filtered. | partly: the filter isn't honoured |

## Spells

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/magic/ForceShield.as` | 29 | A shield's zone and factor: the A x A tiles ending at the tapped tile. | built: `rules/magic.ts` (our zone is the marker's square, DECISIONS.md) |
| `core/magic/MagicSpell.as` | 240 | A spell from the config's `magics`: mana, level, gold and cash price, area by rank; casting counts a use, and the rank comes from uses (25 for rank 2, 50 for rank 3, from the config's globals). | built: `rules/magic.ts`, `ui/spells.ts` |
| `core/magic/MagicSpellInterface.as` | 13 | The two things a spell must do: cast, and show its preview. | not needed: an interface |
| `core/magic/SpellAlterState.as` | 208 | Base of spells that change units for a while and then put them back (Instant Limit, 2x Speed, 2x Range). | built: `rules/magic.ts` |
| `core/magic/SpellBlackHole.as` | 114 | Black Hole: once a second for 15, 20 or 30 seconds, swallows enemies in the middle (not bosses, town halls, chests, keys or big units). | built: `rules/magic.ts` |
| `core/magic/SpellCrack.as` | 76 | Hell Abyss: the ground swallows the enemies in the middle of the square, buildings too. | built: `rules/magic.ts` |
| `core/magic/SpellEnlarge.as` | 60 | Age of Colossus: own units grow twice as big and hit half again as hard for 30, 45 or 60 seconds. | built: `rules/magic.ts` |
| `core/magic/SpellFireBall.as` | 117 | Fire Havoc: 30 fireballs over 3 seconds, every third on an enemy, 150, 200 or 250 each. | built: `rules/magic.ts` |
| `core/magic/SpellFireRain.as` | 94 | A fire rain on one tile that hurts, burns and throws round it. The Greater Demon makes one but never casts it. | not needed: never cast |
| `core/magic/SpellForceShield.as` | 49 | Ether Shield: hits in the zone cut to 70%, 55% or 40% for 20, 30 or 40 seconds. Its zone reads the next rank's area, so at rank 3 it covers nothing. | built: `rules/magic.ts` (kept as ours) |
| `core/magic/SpellFullLimitArea.as` | 36 | Instant Limit: fills the LIMIT bar of own LIMIT units in the middle. | built: `rules/magic.ts` |
| `core/magic/SpellHealingRain.as` | 89 | Sacred Rain: 100 to own units under it; ranks 2 and 3 add 20 a second for 5 or 10 seconds. | built: `rules/magic.ts` |
| `core/magic/SpellIceBall.as` | 73 | Deadly Frostbite: enemy units in the square freeze for 15, 20 or 30 seconds. | built: `rules/magic.ts` |
| `core/magic/SpellPoison.as` | 61 | Poisonous Flood: enemy units take 15, 20 or 25 every few seconds, 5, 7 or 10 times. | built: `rules/magic.ts` |
| `core/magic/SpellRangeIncreaser.as` | 46 | 2x Range: up to 20 own units reach twice as far for 15, 30 or 45 seconds. | built: `rules/magic.ts` |
| `core/magic/SpellSpeedIncreaser.as` | 46 | 2x Speed: up to 20 own units walk twice as fast for 15, 30 or 45 seconds. | built: `rules/magic.ts` |
| `core/magic/SpellStoneRain.as` | 72 | Ultimate Hail: a boulder on each tile; enemy buildings take 800, 1,000 or 1,500, units a tenth and are knocked down. | built: `rules/magic.ts` |
| `core/magic/SpellSummonDragon.as` | 110 | Summon Dragon: one of five Bahamut dragons joins for 30 or 60 seconds (for good at rank 3), with 4,000, 5,000 or 7,000 life. | built: `rules/magic.ts` |
| `core/magic/SpellSummonGolem.as` | 76 | Golem's Wrath: a golem joins with 4,000, 5,000 or 7,000 life. | built: `rules/magic.ts` |
| `core/magic/SpellSummonYeti.as` | 76 | Yeti's Trail: a yeti joins with 4,000, 5,000 or 7,000 life. | built: `rules/magic.ts` |
| `core/magic/SpellThunder.as` | 49 | Spell 1, a lightning storm that stuns. No spell in the config has this id; the game only falls back on it. | not needed: never cast |

## The config's items

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/statics/CostType.as` | 22 | The price letters: g gold, f food, w wood, s stone, c cash. | built: `rules/config.ts` |
| `core/statics/StaticData.as` | 287 | One item of the config (`items`): price, size, life, attack, speed, range, work time, harvest, population, upgrade, limits... | built: `rules/config.ts` |
| `core/statics/StaticDataLibrary.as` | 51 | All the config's items by id. The game changes some of them while it runs (villagers' speed and name, summoned units' life, spells' range and speed). | built: `rules/config.ts` |
| `core/statics/Subcat.as` | 58 | Numbers for the shop's subcategories (houses 11, towers 21, infantry 31, wonders 51...). | built: `rules/shop.ts` |
