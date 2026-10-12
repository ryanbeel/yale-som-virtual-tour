# Yale SOM Virtual Tour (family edition)

A first-person 3D walk-through of Evans Hall floor 2 (Yale SOM), forked from the class repo
`zlisto/yale_som_virtual` and turned into a family playground: AI professors you can chat with,
family characters, and a portal to "Ryan Jr. Island" with three big events (a concert, a giant-cat
sneeze disaster, and the Tiki–Dino War).
React + Vite + three.js (@react-three/fiber) frontend; Python FastAPI + Pydantic AI backend.

- Repo: https://github.com/ryanbeel/yale-som-virtual-tour (public); `upstream` = the professor's repo
- Live site (GitHub Pages, auto-deploys on every push to `main`): https://ryanbeel.github.io/yale-som-virtual-tour/
- The owner is a Yale MBA student (not a programmer). Explain things plainly, test in the browser
  before saying something works, and keep a fun tone.

## Run it

```bash
npm install && npm run dev          # game at http://localhost:5173 (Vite proxies /api to :8000)
cd backend && .venv/bin/uvicorn main:app --reload --reload-exclude '.venv/*' --port 8000
```

- Backend setup is in `backend/README.md`. It reads `PORTKEY_API_KEY` and `OPENAI_MODEL`
  (gpt-5.6-luna via Portkey) from the `.env` in the folder above the repo (`Lecture 7/.env`).
- The app's preview launcher can't read `~/Documents` (macOS privacy), so start `npm run dev` from a
  shell and point the browser pane at http://localhost:5173 (`../.claude/launch.json` is set up that way).
- GitHub CLI is at `~/.local/bin/gh` (logged in as ryanbeel, with `workflow` scope).
- On GitHub Pages there's no backend: chat windows say "offline"; everything else works.

## Ground rules

- **Keep this file current.** Whenever a feature, character, event, file, run step, rule or parked idea
  changes, update CLAUDE.md in the same turn (and include it when pushing). It's how new chats catch up.
- **Never commit secrets.** Before every push: `git add -A`, check the staged diff doesn't contain the
  Portkey key and no `.env` / `.venv` / `__pycache__` files are staged.
- **Ask before pushing.** Pushing publishes to the family link. The owner usually says "push it".
- **Privacy:** Allison and Rose are the owner's kids. Their avatars are cartoons. Their AI agents must
  never share or invent a last name, age, school, location, etc. Flag any new personal detail before it
  goes public.
- Keep it smooth on phones: crowds use instanced meshes; avoid adding always-on point lights; measure
  fps for heavy moments (aim for 60, accept ~45 briefly).
- After pushing, wait for the Pages deploy (`gh run watch`) and grep the live bundle to confirm.

## Map of the code (src/)

**Worlds and core**
- `App.jsx`: Canvas, HUD, chat window, banners/flashes, mute button, screen shake. Picks the world.
- `world.js`: which world you're in (`evans` | `island`); `world.go(name, spawn)`.
- `Player.jsx`: walking/looking (pointer lock or touch); takes an `env` ({ collide, floorAt, locate, spawn }).
- `layout.js` + `World.jsx`: Evans Hall floor plan and meshes. The portal is at the back of room 2220.
- `island.js` + `Island.jsx`: Ryan Jr. Island terrain/layout (+ sky that goes night/storm), with
  `Portal.jsx` back to Evans.
- `Minimap.jsx`: Evans map and island map (cats, shark, "???" button and green GAME button markers).

**Chat-enabled characters** (click, or tap Talk on phones). Built on `talkable.js` + `chat.js` (`talkTo`).
- Rooms are assigned in `Faculty.jsx` (`ROOM_PROFESSOR` / `AVATARS`):
  - 2200 `Zaman.jsx` (pet Labubu)
  - 2210 `Schott.jsx` (Galton board)
  - 2400 `Allison.jsx` (Ryan Jr. the cat, horse, drums)
  - 2410 `Rose.jsx` (guitar, Nirvana poster)
- Other rooms still have the original Hogwarts professors (`Professor.jsx`).
- Room slides: `slides.js` (decks keyed by `DRUMS[].course` in layout.js).
- An "action" character (e.g. Golden Ryan Jr., the DO NOT PRESS button) has `action` instead of a chat.

**Ryan Jr. Island**
- `IslandCats.jsx`: instanced clone army, 100 + 1 per minute. `CloneMachine.jsx`: the Clone-O-Matic.
- `Shark.jsx`: patrols, hunts swimmers, stage dive in the concert, launched by sneezes.
- Concert (Golden Ryan Jr. starts it):
  - `concert.js`: timeline. 20 s countdown, 90 s show, eruption at 45 s, shark lands at 60 s, night fall.
  - `Concert.jsx`: band, crowd, lights, fireworks, confetti.
  - `Volcano.jsx`: the eruption.
  - `music.js`: an original song synthesized with Web Audio, including the shark solo.
- DO NOT PRESS (south beach):
  - `donotpress.js`: the ~50 s timeline, 3 sneezes.
  - `DoNotPress.jsx`: giant Ryan Jr., storm, tsunami, coconuts, dino stampede.
  - The score/SFX is `pressSfx` in `music.js`.
- The Great Tiki–Dino War (GAME NIGHT button west of the arrival plaza, `WAR_BUTTON` (-19, 7.5); the
  battlefield is the open field north of it, `WAR` in island.js; ~72 s):
  - `war.js`: timeline `W` and HUD stages.
    - 2–9 s: rock-paper-scissors at `GAME_TABLE`; the tiki shows its hand late ("YOU WAITED!!! CHEATER!!!"),
      and the dino flips the table.
    - 10 s: 100 dinos (north) and 100 tikis (south) march in.
    - 18 s: charge; 20.6 s: clash, melee and flying warriors.
    - 48 s: reinforcements (2 giant T. rexes, a giant tiki, 60 Ryan Jr. cat cavalry); cannons fire faster.
    - 62 s: mega explosion launches everyone; 66 s: they land in a heap ("Nobody won. Everybody flew.").
    - 8 cannons with deterministic shots (`CANNON_SHOTS`), shared by visuals and sound.
  - `War.jsx`: button, game table, instanced armies (weapons, shields, cat cavalry), giants, cannons,
    explosions, flags, dust, battle-cry bubbles.
  - The epic score is `warMusic` in `music.js` (marimba game tune, taiko march, brass/choir battle theme
    that modulates up at the reinforcements, cannon booms timed to the shots).
  - Runs at ~60 fps at the peak (desktop).
- `DinoCrowd.jsx` (classroom dino students), `TikiParty.jsx` (courtyard tiki party, shared parts/props).

**Backend**
- `backend/main.py` (FastAPI) + `backend/professors.py`: every catalog instructor is a Pydantic AI agent
  built from `data/yale_som.db`, plus `CUSTOM` characters (Allison, Rose).
- Speaking styles: `STYLES`. Room notes: `VIRTUAL_ROOM`. Shared catalog tools: search, course,
  professor, room, categories.

## Testing tips (browser pane)

- Dev-only teleport: `document.body.dataset.go = JSON.stringify([x, z, yawDeg, pitch, y?])`.
  `document.body.dataset.pos` / `.shark` expose positions.
- Get to the island: walk into the 2220 portal (teleport to `[0, -37, 0, 0]`), or `world.go('island')`.
- Fast-forward an event: set `concert.get().start`, `press.get().start` or `war.get().start` to
  `performance.now()/1000 - seconds`.
- Screenshots lag by several seconds, so to inspect a moment, *pin* the clock: a requestAnimationFrame loop
  that keeps setting `start = performance.now()/1000 - T` (then take the screenshot).
- Import the app's own module instance (Vite adds `?t=` after hot reloads):
  `await import(performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/concert.js')).pop())`
- Hot reloads remount the island and reset any running show/event. Re-trigger after edits.

## Ideas parked for later

- **Multiplayer:** see each other in real time (name tags, avatar choice, room code). Needs a small
  always-on server, e.g. WebSockets on Render.
- **Put the AI chat online:** host the FastAPI backend on Render (the owner has an account), with the key
  in Render's env settings and a message rate limit. Then set `VITE_API_URL` for the Pages build.
- More rooms still have Hogwarts professors (2220 Moody, 2230 Flitwick, 2420 Trelawney, 2430 Slughorn).
- Speaking styles for more real professors (the owner provides them).
