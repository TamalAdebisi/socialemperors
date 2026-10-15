// What a browser tab remembers for its session: the original's "once a
// session" things (a standing troll camp put up afresh, the Chinese
// village burnt), as a Flash game's session was one page load.

/**
 * Whether this is the first time in the session (this tab) for something,
 * remembered from now on. True when the browser keeps nothing, as then
 * every load is a new session.
 */
export function firstThisSession(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) {
      return false;
    }
    sessionStorage.setItem(key, "1");
  } catch {
    // no storage: each load counts as a session
  }
  return true;
}
