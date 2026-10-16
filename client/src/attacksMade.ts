// What attacks on players did, for the goals back home (attack a player,
// attack a neighbour): each attack is played on its own page
// (attackPlay.ts), so it's kept in this browser tab, as the Flash client
// kept it until the game was reloaded (as visits are, visit.ts).

const ATTACKS = "se-attacks";

export interface AttackMade {
  victim: string;
  /** Left before the end: not counted for "attack a player", as there. */
  voluntary: boolean;
  /** A spy visit, not an attack. */
  spy?: boolean;
  /** The defender's level and the player's, for the goals about levels. */
  level?: number;
  mine?: number;
}

export function attacksSoFar(): AttackMade[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ATTACKS) ?? "[]") as unknown;
    return Array.isArray(saved) ? saved.filter((a) => a && typeof a.victim === "string") as AttackMade[] : [];
  } catch {
    return [];  // storage refused (a private window): the goals count this page only
  }
}

export function rememberAttack(attack: AttackMade): void {
  try {
    sessionStorage.setItem(ATTACKS, JSON.stringify([...attacksSoFar(), attack]));
  } catch {
    // Not kept, then.
  }
}
