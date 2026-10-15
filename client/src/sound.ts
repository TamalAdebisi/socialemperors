// Music and sound effects (CLIENT.md, "Sound"), as the Flash client plays
// them (our notes, our words): the town's music on a loop, a quarter of full
// volume; the game's own effects, also at a quarter, each a moment (50 to
// 150 ms) after what made it, and no more than a few of one at once, so
// collecting ten farms doesn't make ten times the noise. Music and effects
// each have an on/off button, remembered in this browser.
//
// Browsers only let a page make sound once the player has tapped or pressed
// a key, so nothing plays before then.

/** The effects the town builder plays, from the game's Flash library (tools/art/export_sounds.sh). */
const EFFECTS = {
  click: new URL("./sound/click.mp3", import.meta.url).href,  // a button
  place: new URL("./sound/place.mp3", import.meta.url).href,  // something built, a unit trained, a unit sent off
  collect: new URL("./sound/collect.mp3", import.meta.url).href,
  ready: new URL("./sound/ready.mp3", import.meta.url).href,  // a building ready to collect
  "level-up": new URL("./sound/level-up.mp3", import.meta.url).href,
  lumber: new URL("./sound/lumber.mp3", import.meta.url).href,  // a villager starts on a tree
  stone: new URL("./sound/stone.mp3", import.meta.url).href,  // ...or a rock
  // Battles: a sword's hit (one of two), shots, and the four death cries.
  "sword-1": new URL("./sound/sword-1.mp3", import.meta.url).href,
  "sword-2": new URL("./sound/sword-2.mp3", import.meta.url).href,
  arrow: new URL("./sound/arrow.mp3", import.meta.url).href,
  cannon: new URL("./sound/cannon.mp3", import.meta.url).href,
  ballista: new URL("./sound/ballista.mp3", import.meta.url).href,
  "die-man": new URL("./sound/die-man.mp3", import.meta.url).href,
  "die-woman": new URL("./sound/die-woman.mp3", import.meta.url).href,
  "die-machine": new URL("./sound/die-machine.mp3", import.meta.url).href,
  "die-troll": new URL("./sound/die-troll.mp3", import.meta.url).href,
};
export type Effect = keyof typeof EFFECTS;

/** How many of each effect may play at once, as in the Flash client. */
const AT_ONCE: Record<Effect, number> = { click: 3, place: 3, collect: 3, ready: 3, "level-up": 3, lumber: 3, stone: 2,
  "sword-1": 5, "sword-2": 5, arrow: 8, cannon: 3, ballista: 5, "die-man": 3, "die-woman": 3, "die-machine": 3, "die-troll": 3 };
const VOLUME = 0.25;
const MUSIC_VOLUME = 0.25;
const DELAY_MS = [50, 150];
/** The music: the town's, or the trolls' for a troll town. */
const MUSIC = { h: "Spirit of Eternity.mp3", t: "trollcamp_v2.mp3" };

const SAVED = { music: "se-music", effects: "se-sounds" };

export class Sound {
  private readonly music: HTMLAudioElement;
  private context: AudioContext | null = null;
  private readonly sounds = new Map<Effect, Promise<AudioBuffer | null>>();
  private readonly playing = new Map<Effect, number>();
  private musicOn: boolean;
  private effectsOn: boolean;
  private unlocked = false;
  private readonly listeners = new Set<() => void>();

  /** `assetsUrl`: where the game's files are (the music is in its music/ folder); `race`: the town's;
   * `track`: another of the game's tunes instead (QUESTS.mp3 on an island). */
  constructor(assetsUrl: string, race: string, track?: string) {
    this.musicOn = saved(SAVED.music);
    this.effectsOn = saved(SAVED.effects);
    this.music = new Audio();
    this.music.loop = true;
    this.music.volume = MUSIC_VOLUME;
    this.music.preload = "none";  // only fetched once it can play
    this.music.src = `${assetsUrl}/music/${encodeURIComponent(track ?? (race === "t" ? MUSIC.t : MUSIC.h))}`;
    const unlock = () => {
      this.unlock();
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    // A button anywhere clicks, as the Flash client's did.
    document.addEventListener("click", (e) => {
      if ((e.target as Element | null)?.closest?.("button, a.button")) {
        this.play("click");
      }
    }, true);
    // No music while the page is hidden (another tab, the phone locked).
    document.addEventListener("visibilitychange", () => this.playMusic());
  }

  get musicPlaying(): boolean {
    return this.musicOn;
  }

  get effectsPlaying(): boolean {
    return this.effectsOn;
  }

  /** Hear when music or effects are switched on or off. */
  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    save(SAVED.music, on);
    this.playMusic();
    this.listeners.forEach((listener) => listener());
  }

  setEffects(on: boolean): void {
    this.effectsOn = on;
    save(SAVED.effects, on);
    this.listeners.forEach((listener) => listener());
  }

  /** An effect, a moment from now, unless effects are off or enough of it are playing. */
  play(effect: Effect): void {
    const context = this.context;
    const playing = this.playing.get(effect) ?? 0;
    if (!this.effectsOn || !context || playing >= AT_ONCE[effect]) {
      return;
    }
    this.playing.set(effect, playing + 1);
    const delay = DELAY_MS[0] + Math.random() * (DELAY_MS[1] - DELAY_MS[0]);
    const done = () => this.playing.set(effect, Math.max((this.playing.get(effect) ?? 1) - 1, 0));
    void this.load(effect).then((buffer) => {
      if (!buffer) {
        done();
        return;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = VOLUME;
      source.connect(gain).connect(context.destination);
      source.onended = done;
      source.start(context.currentTime + delay / 1000);
    });
  }

  /** The first tap or key: sound may start. */
  private unlock(): void {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    try {
      this.context = new AudioContext();
    } catch {
      this.context = null;  // no Web Audio: no effects, the music still plays
    }
    this.playMusic();
  }

  private playMusic(): void {
    if (this.musicOn && this.unlocked && document.visibilityState !== "hidden") {
      this.music.play().catch(() => {});  // no music file, or the browser said no: quiet
    } else {
      this.music.pause();
    }
  }

  /** An effect's sound, fetched and decoded once. */
  private load(effect: Effect): Promise<AudioBuffer | null> {
    let sound = this.sounds.get(effect);
    if (!sound) {
      const context = this.context!;
      sound = fetch(EFFECTS[effect])
        .then((response) => response.arrayBuffer())
        .then((data) => context.decodeAudioData(data))
        .catch(() => null);
      this.sounds.set(effect, sound);
    }
    return sound;
  }
}

/** On unless switched off in this browser. Storage can be missing or refused (a private window): then on. */
function saved(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

function save(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {
    // Not remembered, then: it still holds until the page closes.
  }
}
