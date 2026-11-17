# Google Play listing in English

Text to copy and paste into the **main store listing** in Play Console (in the menu, under “Store presence”;
in Spanish, *Presencia en Google Play Store → Ficha de Play Store principal*. Google renames these menus from
time to time). Use it for “English (United States) – en-US”. The Spanish version is in [listing-es.md](listing-es.md) and the
step-by-step guide (in Spanish) is [docs/PLAY_STORE.md](../docs/PLAY_STORE.md).

Each text is inside a box: copy only what is inside. The line under each box says how many characters it
uses and how many Google Play allows. If you change a text, count again with:

```bash
node store/source/check-listings.mjs
```

The texts only describe things the game really has. If something is added to or removed from the game,
review them: Google Play takes down listings that promise what the app does not do.

## App name

```text
Amazing Gorilla Racing
```

22 of 30 characters.

The name is the same in every language. Do not add words such as “free”, “best” or “#1”, or emojis:
Google Play does not allow them in the name.

## Short description

```text
3D kart racing with gorillas: drift, throw coconuts and win every cup
```

69 of 80 characters.

## Full description

```text
Grab the wheel, the gorillas are coming!

Amazing Gorilla Racing is a fast, colourful 3D kart racing game made for your phone. Pick your gorilla, drift through the corners, throw a coconut at the racer ahead and cross the finish line before anyone else. It works offline and has no ads and no purchases.

KARTS THAT TRANSFORM
Your kart does not stay on the tarmac: depending on the stretch of track it turns into a boat, a hang glider or a submarine. Sail through the currents, glide from ring to ring above the clouds and dive along the seabed.

TRACKS AND CUPS
• Tracks grouped in cups: jungle, beach, volcano, ice, neon city, clouds, open sea, seabed, desert, a toy factory and a low-gravity space station.
• Each cup unlocks when you win a trophy in the one before.
• Shortcuts, jump ramps, boost pads and moving hazards on every track.
• Weather that changes the race: showers, blizzards, meteors.
• Every track can also be raced mirrored and in reverse, by day, at dusk or at night.
• Surprise track: a new randomly generated layout every time.

GAME MODES
• Quick race: pick a track and go.
• Cups: several races in a row, with a podium and trophies.
• Time trial: beat your best time against your own ghost and earn bronze, silver and gold medals.
• Elimination: every few seconds, whoever is last is out.
• Stunts: the most points from tricks and drifts wins.
• Balloon battle and Banana fever in three arenas.
• Duels against giant bosses and a different challenge every day.

ARCADE DRIVING
• Drifts with mini-turbos: the longer you hold the drift, the bigger the boost.
• Turbo starts, mid-air tricks and slipstreaming to overtake.
• Power-ups to attack and defend: turbos, coconuts, banana peels, shields, lightning, barrels and more.
• Computer-controlled rivals with several difficulty levels.
• A personal rival who challenges you in every race and adapts to your level.

YOUR GARAGE
• Unlock gorillas and karts with the bananas you earn by racing.
• Upgrade the engine, the tyres and the turbo.
• Customise your kart with paint, hats, wheels, trails, horns and stickers, and pick your victory dance.

ALWAYS SOMETHING TO DO
• Missions in every race and awards to collect.
• A guided tutorial that teaches you to drive and to drift.
• Race replays with cinematic cameras, and a photo mode.
• Challenge your friends: send them a link with your time and they race against your ghost.

MADE FOR YOUR PHONE
• Played with the phone held sideways (landscape).
• The kart accelerates by itself: you steer, drift and use items.
• Controls your way: button size and opacity, left-handed layout or tilt steering.
• You can also play with a gamepad.
• Graphics quality adjusts to your phone automatically.
• In English and Spanish.

NO SMALL PRINT
• No ads.
• No purchases: everything is unlocked by playing.
• No accounts and no sign-up.
• It collects no data. Your progress is saved only on your device.
• It works without an Internet connection.

Three, two, one… go!
```

2975 of 4000 characters.

## Release notes

This is the “Release notes” text you write when you create each release in Play Console. For the first one:

```text
First release of Amazing Gorilla Racing:
• 3D kart racing with gorillas.
• Karts that turn into a boat, a hang glider and a submarine.
• Quick race, cups, time trial, elimination, stunts, balloon battle and bosses.
• A garage with gorillas, karts, upgrades and accessories.
• In English and Spanish, with no ads, and playable offline.
```

334 of 500 characters.

For later releases, say in two or three lines what really changes for the player (“New tracks”, “Fixed a
problem when…”). In Play Console it goes inside the language tags, for example between `<en-US>` and
`</en-US>`.

## Category and tags

In Play Console, under **Store settings** (next to the store listing):

| Field | What to choose |
| --- | --- |
| App or game | Game |
| Category | Racing |
| Tags | Up to five, from the list Google offers. The ones that describe the game best: **Racing**, **Kart racing**, **Arcade**, **Casual**, **Single player**, **Offline**. Pick the ones that exist in the list; skip any that do not. |

Do not pick tags for things the game does not have (multiplayer, open world, simulation…).

## Graphics

| What Google Play asks for | File |
| --- | --- |
| App icon, 512 × 512, 32-bit PNG | [graphics/icon-512.png](graphics/icon-512.png) |
| Feature graphic, 1024 × 500, 24-bit PNG with no transparency | [graphics/feature-graphic-1024x500.png](graphics/feature-graphic-1024x500.png) |
| Screenshots | `screenshots/` folder (sizes in [docs/PLAY_STORE.md](../docs/PLAY_STORE.md#capturas-de-pantalla)) |

Both graphics are generated by `store/source/render.mjs` from the drawing in `store/source/art.js`.
They work for every language: the only text on them is the name of the game.
