# gta6-neon-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lyssandr/gta6-neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lyssandr/gta6-neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Bay** is a complete open-world crime game that runs in a desktop browser from static files, built for make.fun's "Make GTA 6" bounty. You are Ray "Vex" Marlowe, a wheelman fresh out of lockup who owes the harbour crew $5,000. Explore a sun-soaked neon grid city on foot and by car, steal rides, outrun the police, and work six story missions for Dana and Marco, from a first set of wheels to the big getaway.

Everything is original: the city, characters, vehicles, story, art and music. The 3D city is rendered with vendored three.js, the soundtrack and all sound effects are synthesized live with WebAudio, and there is no network request at runtime.

What is in the game:

- A full open world: a grid city with a beach, palm trees, neon rooftops, traffic and pedestrians
- On foot and by car: walk, run, steal any parked car, arcade driving with handbrake turns
- Wanted level (0-5 stars) with police interceptors that chase, ram and bust you
- Six story missions: steal a car, pick up a package, lose the cops, a dockside shootout, a timed delivery and the big getaway
- Combat: hitscan pistol with ammo and reload, rival gang members who shoot back, punching
- HUD with cash, health, wanted stars, speed, ammo, in-game clock, district name and a live minimap
- Start screen, pause screen, busted/wasted screens, story-complete screen
- Save and continue in localStorage, with autosave after every mission
- Synthesized synthwave music, engine hum, sirens, gunshots and crash sounds (M mutes)

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step and no network needed: every file the game loads lives under `game/`.

Controls: WASD move / drive, mouse drag to orbit the camera, E enter or exit a car, click to shoot, F punch, Space brake, R reload, P pause.

---

Entered on [make.fun](https://make.fun/?ref=775gwmbx&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards
