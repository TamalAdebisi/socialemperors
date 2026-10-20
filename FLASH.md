# Playing with real Flash

The home page offers three ways to play. This page is for the one called
**A Flash browser**: the game running in Adobe's own Flash Player, the most
faithful way to play while Ruffle and the new client catch up.

It's also the way for a town with a big army: Ruffle copies Flash Player
in the browser and runs the game's code more slowly than Adobe's own player
usually does, so many units can make it lag.

Browsers dropped Flash at the end of 2020, so you need one of the two
setups below. Old browsers don't get security fixes: use them for the game,
not for everyday browsing.

## The easy way: a browser with Flash inside

[FlashBrowser](https://github.com/radubirsan/FlashBrowser/releases/latest)
is a small browser with Flash Player built in, so there's nothing else to
install. Open the game's address in it (`http://127.0.0.1:5050` when it
runs on your computer; README.md says how), choose *A Flash browser*, and
play.

## The manual way: an old browser and Flash Player

**Flash Player 32.0.0.371** is the last version without Adobe's end-of-life
switch, which stops later versions from running. Adobe's installers are kept
in the [Flash Player archive](https://archive.org/download/flashplayerarchive/)
on the Internet Archive. For Windows:

- [for Firefox and Basilisk](https://archive.org/download/flashplayerarchive/pub/flashplayer/installers/archive/fp_32.0.0.371_archive.zip/32_0_r0_371%2Fflashplayer32_0r0_371_win.exe) (the "NPAPI" kind)
- [for Chromium and Opera](https://archive.org/download/flashplayerarchive/pub/flashplayer/installers/archive/fp_32.0.0.371_archive.zip/32_0_r0_371%2Fflashplayer32_0r0_371_winpep.exe) (the "PPAPI" kind)

Then a browser that still loads it:

- [Basilisk](https://www.basilisk-browser.org/), a Firefox relative that
  still supports plugins like Flash.
- [Firefox 84](https://download-installer.cdn.mozilla.net/pub/firefox/releases/84.0/win64/en-US/Firefox%20Setup%2084.0.exe)
  ([32-bit](https://download-installer.cdn.mozilla.net/pub/firefox/releases/84.0/win32/en-US/Firefox%20Setup%2084.0.exe)),
  the last Firefox with Flash. Turn off its updates straight away (menu,
  *Settings*, *General*, *Firefox Updates*), or it updates itself past Flash.
- [Chromium 82](https://chromium.en.uptodown.com/windows/download/2181158).
  Flash is off at first: switch it on in its settings.

### On Linux

1. A Chromium that still loads Flash: 86.0.4240.75 is known to work
   ([download](https://chromium.cypress.io/linux/stable/86.0.4240.75)).
2. From the [32.0.0.371 archive](https://archive.org/download/flashplayerarchive/pub/flashplayer/installers/archive/fp_32.0.0.371_archive.zip/),
   download `flashplayer32_0r0_371_linuxpep.x86_64.tar.gz` (or
   `flashplayer32_0r0_371_linuxpep.i386.tar.gz` for 32-bit) and extract it
   to `/usr/lib/adobe-flashplugin`.
3. Start Chromium with
   `--ppapi-flash-path=/usr/lib/adobe-flashplugin/libpepflashplayer.so --ppapi-flash-version=32.0.0.371`.
   To avoid typing that every time, put it in `CHROMIUM_FLAGS`.
