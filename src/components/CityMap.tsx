import { useEffect, useRef, useState } from "react";
import {
  BOARD_COLS,
  BOARD_ROWS,
  DECORATIONS,
  LOCATIONS,
  SCENERY,
  getJob,
} from "../game/data";
import { travelCost } from "../game/engine";
import { useGame } from "../game/store";
import type { LocationId } from "../game/types";

const WALK_MS = 750;

export default function CityMap({ onEnter }: { onEnter: (id: LocationId) => void }) {
  const { state, dispatch } = useGame();
  const [walking, setWalking] = useState(false);
  const timer = useRef<number | null>(null);
  const job = state.jobId ? getJob(state.jobId) : null;
  const token = state.ownedItems.includes("car") ? "🚗" : state.avatar;

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  function go(id: LocationId) {
    if (walking) return;
    if (id === state.location) {
      onEnter(id);
      return;
    }
    const cost = travelCost(state, id);
    if (cost > state.hours) {
      dispatch({ type: "MOVE", to: id });
      return;
    }
    dispatch({ type: "MOVE", to: id });
    setWalking(true);
    timer.current = window.setTimeout(() => {
      setWalking(false);
      onEnter(id);
    }, WALK_MS);
  }

  const cellW = 100 / BOARD_COLS;
  const cellH = 100 / BOARD_ROWS;
  const cx = (x: number) => (x + 0.5) * cellW;
  const cy = (y: number) => (y + 0.5) * cellH;

  return (
    <div className="card stage board-card">
      <div className="map-head">
        <div>
          <h2>Fast Lane City</h2>
          <p>Pick a spot — your character strolls over, then you head inside.</p>
        </div>
        <span className="tag">{state.hours}h left</span>
      </div>

      <div
        className="board"
        style={{ ["--cols" as string]: BOARD_COLS, ["--rows" as string]: BOARD_ROWS } as React.CSSProperties}
      >
        <div className="sky" />
        <div className="grass" />
        <div className="plaza" />
        <div className="ring-road" />

        {SCENERY.map((d, i) => (
          <span
            key={"sc" + i}
            className="scenery"
            style={{ left: `${d.left}%`, top: `${d.top}%`, fontSize: `calc(${d.size} * clamp(20px, 3.4vw, 34px))` }}
          >
            {d.icon}
          </span>
        ))}

        {DECORATIONS.map((d, i) => (
          <div
            key={"deco" + i}
            className="deco"
            style={{
              left: `${d.x * cellW}%`,
              top: `${d.y * cellH}%`,
              width: `${cellW}%`,
              height: `${cellH}%`,
            }}
          >
            <span className="deco-icon">{d.icon}</span>
            <span className="deco-name">{d.name}</span>
          </div>
        ))}

        {LOCATIONS.map((loc) => {
          const here = loc.id === state.location;
          const cost = travelCost(state, loc.id);
          const hasJob = job?.locationId === loc.id;
          return (
            <button
              key={loc.id}
              className={"building" + (here ? " here" : "")}
              style={{
                left: `${loc.x * cellW}%`,
                top: `${loc.y * cellH}%`,
                width: `${cellW}%`,
                height: `${cellH}%`,
                ["--tile-accent" as string]: loc.accent,
              } as React.CSSProperties}
              onClick={() => go(loc.id)}
              disabled={walking}
              title={loc.name}
            >
              {hasJob && <span className="badge">★ JOB</span>}
              <div className="bld">
                <div className="roof" />
                <div className="facade">
                  <div className="sign">{loc.short}</div>
                  <div className="placard">{loc.icon}</div>
                  <div className="windows">
                    <span />
                    <span />
                  </div>
                  <div className="door" />
                </div>
              </div>
              <span className="tmeta">{here ? "You are here" : `${cost}h`}</span>
            </button>
          );
        })}

        <div
          className={"token" + (walking ? " walking" : "")}
          style={{ left: `${cx(getLoc(state.location).x)}%`, top: `${cy(getLoc(state.location).y)}%` }}
          aria-hidden
        >
          <span className="token-glyph">{token}</span>
          <span className="token-shadow" />
        </div>

        <div className="week-plate">
          <span className="wp-week">Week {state.week}</span>
          <span className="wp-sep">·</span>
          <span className="wp-hours">{state.hours}h left</span>
        </div>
      </div>
    </div>
  );
}

function getLoc(id: LocationId) {
  return LOCATIONS.find((l) => l.id === id)!;
}
