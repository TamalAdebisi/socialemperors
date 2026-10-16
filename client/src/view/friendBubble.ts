// A friend's help waiting over a building (rules/friendsHelp.ts), drawn as
// the Flash client's FotoNeighbour: the game's white bubble pointing down at
// the building, the friend's picture in it, and its blue label, "Hurry Up?",
// which says "Accept" with the game's hand over the bubble while the mouse
// is on the building. The site has no pictures of friends, so theirs is
// their initial on a colour, as in the neighbours' list.

import { Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";

import anchors from "./art/anchors.json" with { type: "json" };

const PICTURES = {
  "friend-bubble": new URL("./art/friend-bubble.webp", import.meta.url).href,
  "friend-label": new URL("./art/friend-label.webp", import.meta.url).href,
  "friend-hand": new URL("./art/friend-hand.webp", import.meta.url).href,
};
/** Where the label's own point is in the bubble (game pixels), and its words' middle from there. */
const LABEL_AT = { x: -62.3, y: 3.7 };
const WORDS_AT = { x: 61, y: 18.5 };
/** The picture's square in the bubble, as the game puts a 100-pixel photo there. */
const PHOTO = { x: -50, y: -100, size: 100 };
/** The neighbours' list's portrait colours (ui/neighbours.ts). */
const COLOURS = [0xc0392b, 0x2e86c1, 0x8e44ad, 0x16a085, 0xd35400, 0x27ae60, 0xb7950b, 0x7f8c8d];

const loading = new Map<string, Promise<Texture | null>>();

function texture(url: string): Promise<Texture | null> {
  let load = loading.get(url);
  if (!load) {
    load = Assets.load<Texture>(url).catch(() => null);
    loading.set(url, load);
  }
  return load;
}

export interface FriendWords {
  /** The game's "Hurry Up?" and "Accept". */
  hurry: string;
  accept: string;
}

/** The bubble, its point at the building's top; `light` shows the hand and "Accept" (the mouse on it) or not. */
export function friendBubble(name: string, words: FriendWords): { sign: Container; light: (on: boolean) => void } {
  const sign = new Container();
  const portrait = new Graphics()
    .roundRect(PHOTO.x, PHOTO.y, PHOTO.size, PHOTO.size, 14)
    .fill({ color: COLOURS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLOURS.length] });
  const initial = new Text({
    text: (name.trim()[0] ?? "?").toUpperCase(), anchor: 0.5,
    style: { fontFamily: "system-ui, sans-serif", fontSize: 60, fontWeight: "900", fill: 0xffffff },
  });
  initial.position.set(PHOTO.x + PHOTO.size / 2, PHOTO.y + PHOTO.size / 2);
  const label = new Text({
    text: words.hurry, anchor: 0.5,
    style: { fontFamily: "system-ui, sans-serif", fontSize: 22, fontWeight: "800", fill: 0xffffff },
  });
  label.position.set(LABEL_AT.x + WORDS_AT.x, LABEL_AT.y + WORDS_AT.y);
  let hand: Sprite | null = null;
  let lit = false;
  void Promise.all(Object.values(PICTURES).map(texture)).then(([bubble, pill, glove]) => {
    if (sign.destroyed) {
      return;
    }
    const back = bubble && sprite(bubble, "friend-bubble");
    const under = pill && sprite(pill, "friend-label");
    under?.position.set(LABEL_AT.x, LABEL_AT.y);
    hand = glove && sprite(glove, "friend-hand");
    if (hand) {
      hand.visible = lit;
    }
    sign.addChildAt(back ?? new Container(), 0);
    sign.addChild(...[under, label, hand].filter((part): part is Sprite | Text => part !== null));
  });
  sign.addChild(portrait, initial, label);
  return {
    sign,
    light: (on) => {
      lit = on;
      label.text = on ? words.accept : words.hurry;
      if (hand) {
        hand.visible = on;
      }
    },
  };
}

function sprite(texture: Texture, name: keyof typeof PICTURES): Sprite {
  const anchor = (anchors as Record<string, { x: number; y: number; scale: number }>)[name];
  const picture = new Sprite(texture);
  picture.anchor.set(anchor.x, anchor.y);
  picture.scale.set(1 / anchor.scale);
  return picture;
}
