// Numbers as the player reads them.

/** A time left: "45 s", "1 min 10 s", "2 h 13 min", "1 day 4 h". */
export function duration(seconds: number): string {
  const s = Math.max(Math.ceil(seconds), 0);
  if (s < 60) {
    return `${s} s`;
  }
  if (s < 3600) {
    const minutes = Math.floor(s / 60);
    return s % 60 ? `${minutes} min ${s % 60} s` : `${minutes} min`;
  }
  const minutes = Math.ceil(s / 60);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""}${hours % 24 ? ` ${hours % 24} h` : ""}`;
}
