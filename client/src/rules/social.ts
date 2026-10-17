// Social buildings (the Summit, the Allied Markets...), staffed by friends
// or by helpers hired for cash. As the town opens, the Flash client hires
// one helper free at a social building whose staff list the save keeps
// (our notes, our words: docs/original/rules/neighbours.md): when the list
// is empty and it has 3 places or more, or when it has exactly one helper
// and 7 places or more. One a load, so two at most over two loads. Their
// windows are in the classic game for now; the helpers are the server's.
// No drawing here.

import type { Command } from "../net/commands.ts";
import type { Town } from "./town.ts";

/** The free helpers as the town opens: the commands, our copy of the town counting them. */
export function freeHelpers(town: Town): Command[] {
  const commands: Command[] = [];
  for (const placed of town.items) {
    const places = placed.item.staffPlaces ?? 0;
    if (!placed.item.social || placed.staff === undefined || (placed.item.workerCost ?? 0) <= 0) {
      continue;
    }
    if ((placed.staff === 0 && places >= 3) || (placed.staff === 1 && places >= 7)) {
      placed.staff += 1;
      placed.staffIds?.push("0");
      commands.push({ cmd: "buy_si_help", args: [placed.tx, placed.ty, town.id, placed.item.id, 1] });
    }
  }
  return commands;
}
