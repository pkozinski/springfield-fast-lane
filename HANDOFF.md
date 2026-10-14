# Springfield Fast Lane — Agent Handoff

A Simpsons-themed, 3D cartoon reimagining of the 1990 life-sim *Jones in the Fast Lane*. The
rival "Jones" is **Ned Flanders** ("Keeping up with the Flanderses"). This doc is the single
source of truth for a new agent picking up the work. Read it fully before editing.

**IP note:** the user chose real Springfield names/characters. This is a **private, local fan
game**: never publish, deploy, or distribute it. All art is still original procedural geometry
(no copied show artwork or logos).

## Where things are
- **Project root:** `C:\Users\kozin\OneDrive\Documents\Jones-ITFL`
- Git repo (local only, branch `main`, no remote). Commit history tells the story.
- Dev server: `npm run dev` → http://localhost:5173 (hot-reload).
- Platform: Windows 11, PowerShell. Node/npm/git/python installed. A **Bash tool** (Git Bash) is
  used for the screenshot workflow below.

## Run / build
```powershell
npm install        # three + @types/three already in package.json
npm run dev        # http://localhost:5173
npm run build      # tsc && vite build  (MUST pass before committing)
```
`npm run build` prints a harmless npm-notice NativeCommandError in PowerShell and a Three.js
>500 kB chunk warning. Neither is a failure — look for `✓ built`.

## Stack & architecture
React 18 + TypeScript + Vite. **Three.js** renders the board.

```
src/
  main.tsx                 mounts <App/> inside <GameProvider/> (StrictMode: reducer must be pure)
  App.tsx                  phase routing (intro / playing / won / lost), HUD, board, sidebar, location card
  index.css                ALL styling: bright cartoon theme (ink outlines, hard shadows, sky + clouds).
                           Fonts: "Luckiest Guy" (titles) + "Nunito" (body), loaded in index.html
  game/                    framework-free game model (no React)
    types.ts               domain types; GameState (incl. rival, lostTo, seed)
    data.ts                ALL content + tuning: LOCATIONS, JOBS, COURSES, ITEMS, FOODS, LEISURE,
                           HOMES, CONFIG, DEFAULT_GOALS, RING + ring helpers, RIVAL_JOBS, RIVAL_QUOTES
    engine.ts              pure reducer + selectors (netWorth, goalProgress, rivalProgress, travelCost);
                           seeded RNG `rand(s)` (mulberry32 over state.seed); endWeek -> rivalWeek
    store.tsx              React context + reducer + localStorage autosave (key springfield.save.v1)
  components/
    Board.tsx              board card: header, 2D/3D switch (saved in localStorage springfield.boardStyle; 3D default)
    FlatBoard.tsx          optional 2D board: flat Jones-style grid of storefront tiles + walking tokens
    Facades.tsx            front-facing SVG storefront art per location + the town square
    CityMap.tsx            the Three.js 3D board (optional; lazy-loaded so Three.js only loads on demand)
    LocationPanel.tsx      the location card (opens over the board)
    HUD.tsx, Sidebar.tsx   top bar; Life Goals, Flanders race card, Condition, Activity Log
    Clock.tsx              cartoon week-clock SVG
    Icon.tsx               line-icon set (incl. donut, pin, mug, atom, globe) + location/item icon maps
    Portrait.tsx           yellow cartoon face SVGs: 8 player avatars (p0..p7) + RivalPortrait (Ned)
  screens/Intro.tsx, screens/GameOver.tsx
```

## Game model (quick map)
- **Goals:** Wealth (net worth), Career (job tier), Education (degrees), Happiness. Win = all four
  met. Lose = Flanders meets all four first (`lostTo: "rival"`) or weeks run out (`"time"`).
- **Locations (ids):** home (Evergreen Terrace), employment, university, krusty, trynsave, mall (Springfield Mall; was Globex),
  aztec, moes, bowlarama, kwikemart, lardlad, plant (Nuclear Power Plant: Safety Inspector, Nuclear Engineer, Exec Assistant to Mr. Burns), bank.
- **Education (Jones-style):** `DEGREES` in `data.ts` form a prerequisite tree. ENROLL pays the
  fee once; ATTEND spends `classHours(s)` (6h, 5h with a laptop) per class; after
  `CONFIG.classesPerDegree` (5) classes you graduate. State: `degrees` (earned ids) + `enrolled`
  (id -> classes attended). Jobs need a specific degree via `reqDegree`. Old credit-based saves are
  migrated in `store.tsx` (degree track restarts).
- **Movement:** perimeter ring. `RING` in `data.ts` is the clockwise cell order (13 locations + the
  Flanders house pass-through cell, `FLANDERS_CELL`). `ringPath`/`ringDistance` drive movement and
  travel cost.
- **Flanders:** `state.rival` {cell, worth, credits, careerLevel, happiness, jobTitle, quote}. Each
  week `rivalWeek()` adds randomized income (`CONFIG.rivalWeeklyIncome`), 0-2 classes
  (`CONFIG.rivalClassOdds`, graduating every 5 into `RIVAL_DEGREES`), promotions via `RIVAL_JOBS` (by degree count), cheer, and logs a quote (`kind: "rival"`).
  On player MOVE he may wander to a random ring cell. Simulated pace: median finish week 23
  (p10 20, p90 25), so he beats the 24-week limit ~82% of runs. Tune with the two CONFIG knobs.
- **Reducer purity:** never use `Math.random` in the engine; use `rand(s)`. START takes a `seed`.

## The flat board — `components/FlatBoard.tsx` (optional, behind the 2D switch)
- CSS grid 5 x 4 (`.flat-grid`), tiles placed by each location's `x/y`; the Flanders house is a
  static tile; the town square spans the middle with the week clock in it. Styles: `.board-flat`,
  `.tile`, `.flat-square`, `.flat-token` in `index.css`.
- Art: `Facade({id})` in `Facades.tsx`, one function per location, drawn in a 160x120 viewBox on
  ground line y=116. Edit a building there.
- Tokens: `spot(cell)` puts a token on the walkway just inside the ring (like `tokenWorld` in 3D).
  Clicking a tile steps the token through `ringPath` every 230 ms, then dispatches MOVE and opens the card.
- Why flat: on a square ring, every 3D camera angle left the side/corner buildings foreshortened
  (corner 3/4 and straight-on variants were both tried and rejected by the user).

## The 3D board — `components/CityMap.tsx` (the default)
- **Look:** `MeshToonMaterial` everywhere via `toon(color)` (3-band gradient map) + `glow(color)` for
  self-lit bits, rendered through `OutlineEffect` for ink outlines. `noOutline(mat)` opts a material
  out (signs, clouds). No env map / PBR anymore.
- **Render passes** (in `tick`): 1) city `scene` (outline effect), 2) clear depth → `tokenScene`
  (player + Ned, so buildings in the row in front can never hide them; fake blob shadows live in
  the main scene), 3) `labelScene` (all name-label sprites, moved there after construction; sprites
  use `sizeAttenuation: false` so they're a constant on-screen size).
- **Camera:** the original perspective view (41° FOV at (0, 10.2, 8.3) looking at (0, 0.5, -0.35)).
  The user tried and rejected: corner 3/4 perspective, straight-on 28° auto-framed, top-down
  orthographic, and the flat 2D board (still behind the 2D switch). Don't change it without asking.
- **Buildings:** `buildBuilding(loc)` returns `{ group, body, topY, halfW }`; one `case` per
  location id. `body` = main clickable mesh (hover tints its material's emissive). Helpers come from
  `kit(g)`: `box`, `cyl`, `ball`, `mesh`, `hipRoof`, `mansard`, `win`, `winSide`, `sign` (canvas-text
  plane), `person` (tiny townsperson). `signMesh()` supports `{bg, fg, stroke, vertical}`.
  `buildFlandersHouse()` sits on the pass-through cell. Town square has a founder statue + trees.
- **Tokens:** `makeFigure(look, ringColor)` builds a chunky cartoon character. Player look comes
  from `TOKEN_LOOK[avatar]` + `avatarShirt(avatar)`; Ned uses `NED_LOOK`.
- The board waits (≤1.5 s) for the Luckiest Guy font before building so canvas text is correct.

## Visual verification workflow (IMPORTANT)
You cannot see the app otherwise. After `npm run build`, serve `dist` and screenshot with headless
Edge using the **hardware GPU** (`--use-angle=d3d11`; SwiftShader renders wrong).

1. Serve (background Bash task): `node node_modules/vite/bin/vite.js preview --port 4317 --strictPort`
2. Write `dist/preview.html` = `dist/index.html` with a `<script>` injected at the top of `<head>` that
   does `localStorage.setItem('springfield.save.v1', JSON.stringify(state))` (a full GameState incl.
   `rival`, `lostTo`, `seed`), or `localStorage.clear()` for the intro screen. To open a location
   card, also append a script that dispatches a `pointerdown` on `.board-canvas canvas` over a building
   after ~3.5 s, with `location` set to that building.
3. Screenshot:
```
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --no-sandbox \
  --use-angle=d3d11 --hide-scrollbars --force-device-scale-factor=1 --window-size=1280,900 \
  --virtual-time-budget=8000 --user-data-dir="C:/Users/kozin/AppData/Local/Temp/edge-x" \
  --screenshot="<scratchpad>/shot.png" "http://localhost:4317/preview.html"
```
   Delete the `edge-x` profile dir between shots so localStorage doesn't leak.
4. Read the PNG. Stop the preview server when done. (`npm run build` wipes `dist/`.)

## Git conventions
- Commit only when a change builds. End commit messages with the co-author line given in the
  session's attribution instructions.
- Do NOT push (no remote) and do not force anything unless asked.
- PowerShell `git commit` here-strings break on quotes; use multiple `-m` flags, or commit from Bash.
- CRLF/LF warnings on commit are harmless.

## Status
Done: full Springfield conversion (content, cartoon UI, toon 3D board with all 13 landmarks +
Flanders house, character tokens, Flanders AI rival with race card and loss condition), skippable
tutorial, walkway loop, Jones-style degrees. Rendering: shadow map only redraws while a building
hover-bobs (`shadowMap.autoUpdate = false`), and the board's loop pauses while a location card is open.

## Backlog / ideas (not started)
- **Juice:** coin-burst on earning, SFX (hop, cha-ching, "D'oh!"-style stings), confetti win screen.
- **Gameplay:** satirical random weekly events (Mr. Burns layoffs, Lottery, Duff Days, a
  Kwik-E-Mart robbery); balance pass on how winnable 22 weeks is; difficulty setting for Ned's pace.
- **Polish:** the player's car ("The Homer") could swap the token for a car; Ned could walk the ring
  path rather than gliding straight; labels could fade when the location card is open.
- Three.js makes the JS bundle ~700 kB (fine for local). Could code-split later.
