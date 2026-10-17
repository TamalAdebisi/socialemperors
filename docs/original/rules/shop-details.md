# Shop details

Read locally: GUI/InfoButtonOver, GUI/ItemButtonLarge, GUI/Tab,
GuiManager.setMenu, GUI/SubCategory, Config's relevant constants and
Language ids. Numbers and descriptions below are our own notes.

The original chooses a layout per kind. Houses show population and timer;
worker buildings and ranches show base earnings, timer and capacity;
autonomous production shows base earnings and timer. The sacrifice altar,
treasure mine, training stable and hatchery have their own descriptions.
Blacksmith and university show ten percent. Markets show lots of
100/200/300. Eagles show 200/400/800/10000 scout life. Healing buildings
show their healing/attack value; refuges show capacity. Population wonders
refer to the 175 limit and their own population, while resource wonders
show earnings and timer. Decorations show their experience.

Training buildings show their unit's six stats and animation; a castle
also shows its own defensive stats. Towers, walls, gates and dragon-killer
castles use their own defensive values. Feature and hero buildings retain
their individual game descriptions. Attack delay remains in the original
raw frame value. No map-progress multiplier is applied to shop facts.

Original category art maps Village/Defense/Army/Decorations/Wonders to
Flash tab frames 1/3/4/2/7; New uses the final frame. Only the graphic layer
is exported, omitting the placeholder caption. The original New badge is
used unless the limited-edition tab takes precedence. Limited days round
up from the local-calendar expiry and never fall below zero; the badge
changes no sale eligibility. Early cash unlocking stays disabled.

Built in rules/shopDetails.ts, ui/shopDetails.ts and ui/shop.ts. At the
owner's request on 17 October 2026, the white bubble opens only through
an explicit Details click, tap or keyboard activation at every width.
Hovering or focusing a card or button leaves it closed, including in
Storage and for locked items. The visible button says Details so long
item names cannot overflow it; its accessible name retains the item name.
Purchasing remains its separate existing action. Original
resource/stat icons and training animations are reused. Tall bubbles use
their measured height to stay inside the viewport. Each card and its
Details action share a grid-row wrapper, so a full-height card cannot
cover the next row's button. The first browser check exposed that overlap;
its original real-click assertion is retained. Tests:
shopDetails.test.ts and e2e/tests/shop-details.mjs.
