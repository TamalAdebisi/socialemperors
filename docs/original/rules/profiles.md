# Profiles and missing-town-hall notices

Read locally: PopupPlayerProfile, HonorManager, PopupNoTownhall and
PopupManager's startup sequence. Server contract: worlds.profile through
get_public_player_info.php. These notes use our own words.

A public profile shows the name, first town's level/name, honour, rank,
attack wins/losses, last login and country when available. Honour rank is
the highest configured threshold no greater than the points, with the
corresponding b_N.png original badge. The rank list shows every configured
name and threshold. The original Facebook photo and messaging controls
have no equivalent account service here; use the existing initial portrait
and omit messaging. The public API supplies no country today, so none is
invented. Last seen uses an accurate local date/time rather than the
original's mistaken hours/seconds fields and 86,000-second day divisor.

Built: rules/profile.ts and ui/profile.ts, through Army → My profile,
Neighbours and the existing world profile menu. Own/neighbour loads flush
pending commands first, support Retry and ignore late results after close
or replacement. World-map results also check their request/window and
are invalidated when the map or island selection changes. Text remains
text; no profile field is interpreted as HTML.

The original own-town startup checks for an own town hall and shows its
missing-hall notice. Acknowledgment only resumes startup. main.ts now
shows that notice before the ordinary welcome sequence; it neither buys
a new hall nor rewrites the save. Assault missing-hall behavior is outside
this slice and belongs to the combat work. Pending tournament reopening
waits for notices to finish too.

New menu cash commands also retain the ordinary spending mission credit:
collection cash completion, missing-unit purchases and paid darts count
when queued; free throws, full-set exchanges and prizes do not. Social
costs retain their separate callback. The existing cash-balance poll only
adds the unrecorded part of a decrease; it cannot count an explicit
payment again, and a matching reward cannot erase the payment event.
Tests: profile.test.ts, goals.test.ts, e2e/tests/profiles.mjs,
e2e/tests/basic-notices.mjs, e2e/tests/menu-progress.mjs and the existing
world-map browser scenario. The menu-progress browser case also claims
the recruitment and allied-market rewards through their windows and checks
that goals 104 and 115 stay rewarded after reload.
