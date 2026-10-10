# 🏁 Fast Lane

A modern reimagining of the 1990 Sierra classic **Jones in the Fast Lane** — built with React, TypeScript, and Vite.

You arrive in the city with a little cash and a big ambition. Over a fixed number of weeks you juggle a ticking clock, a bank balance, and your own happiness while chasing four life goals:

| Goal | How you grow it |
|------|-----------------|
| 💰 **Wealth** | Earn wages, invest savings, buy assets (net worth). |
| 📈 **Career** | Apply for higher-tier jobs as you qualify. |
| 🎓 **Education** | Take university courses to earn credits. |
| 😊 **Happiness** | Shopping, leisure, a nicer home — don't burn out. |

Hit all four before time runs out and you win.

## The loop

- **Time is the real currency.** Each week gives you a budget of hours. Travel between locations, working, studying, eating, and relaxing all consume them.
- **Energy & happiness** drain over time. Eat to keep energy up; relax, shop, and upgrade your home to stay happy.
- **Money** comes from working your job; spend it on education and assets, or invest it at the bank (savings earn interest, loans cost interest).
- **Sleep at home** to end the week — rent and interest are settled, then a fresh week begins.

## Look & feel

A clean, modern dark UI over the classic board layout: the city's locations ring the edges of
the board around a hollow centre, connected by a loop path, and clicking one walks an animated
character token there before the location opens as a centred panel — faithful to the original's
flow, modern in style (soft surfaces, rounded cards, smooth motion, Inter type). Your token
becomes a car once you buy one.

## Modernized under the hood

- A live goals dashboard and activity log alongside the retro chrome.
- A real net-worth economy (cash + savings + owned assets − debt).
- An electric car that halves travel time; a laptop that speeds up studying.
- Autosave to `localStorage` — close the tab and pick up where you left off.
- Tunable difficulty and content in [`src/game/data.ts`](src/game/data.ts).

## Run it

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Project layout

```
src/
  game/        # pure game model — no React
    types.ts     domain types
    data.ts      all content + tuning (jobs, courses, items, homes…)
    engine.ts    reducer + selectors (netWorth, goals, travel, week rollover)
    store.tsx    React context + autosave
  components/  # HUD, Sidebar, CityMap, LocationPanel
  screens/     # Intro, GameOver
  App.tsx      # view routing
```

The game logic in `src/game/` is intentionally framework-free and deterministic, so it's easy to test or reuse. Balance and content live entirely in `data.ts`.
