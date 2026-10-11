# Fast Lane — Agent Handoff

A modern, 3D reimagining of the 1990 life-sim *Jones in the Fast Lane*. This doc is the
single source of truth for a new agent picking up the work. Read it fully before editing.

## Where things are
- **Project root:** `C:\Users\kozin\OneDrive\Documents\Jones-ITFL`
- Git repo (local only, branch `main`, no remote). Commit history tells the story.
- Dev server is usually already running at **http://localhost:5173** (`npm run dev`, hot-reload).
- Platform: Windows 11, PowerShell. Node/npm/git installed. A **Bash tool** is also available
  (Git Bash) and is used for the screenshot workflow below.

## Run / build
```powershell
cd "C:\Users\kozin\OneDrive\Documents\Jones-ITFL"
npm install        # three + @types/three already in package.json
npm run dev        # http://localhost:5173
npm run build      # tsc && vite build  (MUST pass before committing)
```
Note: `npm run build` prints a harmless PowerShell "NativeCommandError" (npm notices on stderr)
and a Three.js >500 kB chunk-size warning. Neither is a failure — look for `✓ built`.

## Stack & architecture
React 18 + TypeScript + Vite. **Three.js** renders the board.

```
src/
  main.tsx                 mounts <App/> inside <GameProvider/>
  App.tsx                  phase routing (intro / playing / won / lost); renders PortraitDefs,
                           HUD, CityMap (board), Sidebar, and the location "deed" overlay
  index.css                ALL styling. CK3-inspired theme via CSS variables in :root
  game/                    framework-free game model (no React)
    types.ts               domain types; GameState
    data.ts                ALL content + tuning: LOCATIONS, JOBS, COURSES, ITEMS, FOODS,
                           LEISURE, HOMES, AVATARS, CONFIG, DEFAULT_GOALS, RING + ring helpers
    engine.ts              pure reducer + selectors (netWorth, goalProgress, travelCost, endWeek)
    store.tsx              React context + reducer + localStorage autosave (key fastlane.save.v1)
  components/
    CityMap.tsx            *** the Three.js 3D board *** (biggest/most important file)
    LocationPanel.tsx      the "Title Deed" card (opens over the board)
    HUD.tsx                top bar: portrait, clock, stats, End Week button
    Sidebar.tsx            Life Goals, Condition meters, Activity Log
    Clock.tsx              analog week-clock SVG (hand sweeps as hours deplete)
    Icon.tsx               custom gold SVG icon set (no emoji) + locationIcon/itemIcon helpers
    Portrait.tsx           cameo portrait medallions (avatars) + PortraitDefs
  screens/Intro.tsx, screens/GameOver.tsx
```

## Game model (quick map)
- **Goals:** Wealth (net worth), Career (job tier), Education (credits), Happiness. Win = all four
  met before `weekLimit`; lose = time runs out.
- **Time:** weekly hour budget (`CONFIG.hoursPerWeek`). Moving/working/etc. spend hours.
- **Movement:** the board is a **perimeter ring**. `RING` in `data.ts` is the clockwise cell order
  (13 locations + a park waypoint). `ringPath(from,to)` / `ringDistance(from,to)` drive movement
  and travel cost (= spaces moved). Out of time → auto-sent home, week rolls over; `End Week`
  button and `SLEEP`-from-anywhere are the safety nets.

## The 3D board — `components/CityMap.tsx` (READ THIS BEFORE EDITING BUILDINGS)
One Three.js scene built imperatively in `initScene()`, driven from React via refs.
Key pieces:
- **World mapping:** `cellToWorld(gx,gy)`; `tokenWorld(gx,gy)` offsets the token toward the
  camera (+z) so it stands in front of its building.
- **Lighting:** HemisphereLight + AmbientLight + a shadow-casting DirectionalLight, ACES tone
  mapping, and a **PMREM-baked `RoomEnvironment`** (`scene.environment`) for reflections.
- **Materials look premium via:** rounded geometry (`rb()` = `RoundedBoxGeometry`) + env-mapped
  `MeshPhysicalMaterial` (clearcoat) and glossy gold/metal/glass. Avoid raw `BoxGeometry` for
  anything visible — use `rb()`.
- **Buildings:** `buildBuilding(loc)` returns `{ group, body, topY, halfW }`.
  - `body` = the main clickable mesh (hover emissive highlight toggles on it); set `body.userData.locId`.
  - `topY`/`halfW` position the name label and the job star.
  - There is a `switch (loc.id)` — **each location has its own case**. Helpers available inside:
    `mkBox(w,h,d,y,mat)`, `flatRoof(w,h,d)`, `door(d)`, `addWindows(...)`, `rb(...)`, `shade(hex,amt)`,
    and prebuilt materials `bodyMat/roofMat/rimMat/winMat/glassMat/gold/metal/doorMat`.
- **Token:** a glossy gold game-piece (pawn) that hops the ring space-by-space with an arc; swaps
  to a car `Icon` when the player owns the car.
- **Clock plate** (bottom-left) and **billboard name labels** (canvas sprites) overlay the scene.
- Interaction: raycaster for hover + click; click runs `startWalk()` which tweens along `ringPath`
  then dispatches `MOVE` and opens the deed.

### Pattern for detailing a building (what we've been doing)
Replace that location's `case` in the switch with richer original geometry. Keep it recognizable,
set `body`, and update `topY`/`halfW`. All art is **original/procedural** — do NOT reproduce real
brand logos or copyrighted designs (generic storefronts only). Look at the committed `gym`,
`factory`, and `university` cases as the quality bar (plinths, glazed facades with mullions,
canopies, steps, rooftop HVAC, parapets, signage, towers/domes, etc.).

## Visual verification workflow (IMPORTANT)
You cannot see the app otherwise. After `npm run build`, serve `dist` and screenshot with headless
Edge using the **hardware GPU** (`--use-angle=d3d11`). Software WebGL (SwiftShader) renders the
env-map/physical-material path BLACK — not a bug; always use d3d11.

1. Serve (background Bash task): `node node_modules/vite/bin/vite.js preview --port 43XX`
2. Build a `dist/preview.html` that seeds a playing save into localStorage then loads the hashed
   JS/CSS from `dist/assets/` (set `location` to the building you want centered; include the Google
   Fonts `<link>` for Cinzel + EB Garamond). See git history / prior preview.html for the exact save shape.
3. Screenshot:
```
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --no-sandbox \
  --use-angle=d3d11 --hide-scrollbars --force-device-scale-factor=1 --window-size=1120,760 \
  --virtual-time-budget=6000 --user-data-dir="C:/Users/kozin/AppData/Local/Temp/edge-x" \
  --screenshot="<scratchpad>/shot.png" "http://localhost:43XX/preview.html"
```
4. Read the PNG to view it. Stop the preview server task when done.
(`npm run build` wipes `dist/`, so recreate `preview.html` after each build.)

## Git conventions
- Commit only when a change builds. Co-author every commit:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Do NOT push (no remote) and do not force anything unless asked.
- **PowerShell gotcha:** `git commit` here-strings break on quotes in the message. Use multiple
  `-m "..."` flags with no fancy punctuation instead.
- CRLF/LF warnings on commit are harmless.

## Status — building detail passes
Done (full realistic detail): **gym, factory, university**.
Remaining (still the simpler v2 shapes): **bank, hitech, cinema, club, zmart, grocery, cafe,
burger, employment, home**.

### Next task the user asked for
Continue the detail pass on the remaining buildings, same quality bar, a couple at a time (or do a
full sweep and present one combined render). After each: `npm run build`, screenshot via the GPU
workflow, then commit.

## Backlog / ideas (not started)
- **Juice pass:** coin-burst particles on earning, SFX (hop / cha-ching / week chime), a confetti
  win screen, subtle camera ease.
- **Gameplay:** "Jones" the AI rival (keeping-up-with-the-Joneses head-to-head) + satirical random
  weekly events (lottery, mugging, tax refund, inflation).
- **Polish:** per-building color/trim variation; optional brighter "daytime" palette; contact
  shadows/AO; token could show the player's avatar/color.

## Housekeeping notes
- Legacy CSS from older board versions (`.iso-*`, `.building`, `.facade`, etc.) and emoji `icon`
  fields in `data.ts` are now unused but harmless; can be pruned.
- Three.js makes the JS bundle ~660 kB (fine for local). Could code-split later.
