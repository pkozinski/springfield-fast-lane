import { useEffect, useRef, useState } from "react";
import {
  BOARD_COLS,
  BOARD_ROWS,
  DECORATIONS,
  LOCATIONS,
  getJob,
} from "../game/data";
import { travelCost } from "../game/engine";
import { useGame } from "../game/store";
import type { LocationId } from "../game/types";

const WALK_MS = 700;

export default function CityMap({ onEnter }: { onEnter: (id: LocationId) => void }) {
  const { state, dispatch } = useGame();
  const [walking, setWalking] = useState(false);
  const timer = useRef<number | null>(null);
  const job = state.jobId ? getJob(state.jobId) : null;
  const token = state.ownedItems.includes("car") ? "🚗" : "🚶";

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function go(id: LocationId) {
    if (walking) return;
    if (id === state.location) {
      onEnter(id);
      return;
    }
    const cost = travelCost(state, id);
    // Not enough hours: dispatch anyway so the engine logs the reason, then stay put.
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

  const cx = (x: number) => ((x + 0.5) / BOARD_COLS) * 100;
  const cy = (y: number) => ((y + 0.5) / BOARD_ROWS) * 100;

  return (
    <div className="card stage board-card">
      <div className="map-head">
        <div>
          <h2>Fast Lane City</h2>
          <p>Click a place — your character walks there, then you step inside.</p>
        </div>
        <span className="tag">{state.hours}h left</span>
      </div>

      <div
        className="board"
        style={
          { ["--cols" as string]: BOARD_COLS, ["--rows" as string]: BOARD_ROWS } as React.CSSProperties
        }
      >
        <div className="grass" />
        <div className="ring-road" />

        {DECORATIONS.map((d, i) => (
          <div
            key={"deco" + i}
            className="deco"
            style={{
              left: `${(d.x / BOARD_COLS) * 100}%`,
              top: `${(d.y / BOARD_ROWS) * 100}%`,
              width: `${100 / BOARD_COLS}%`,
              height: `${100 / BOARD_ROWS}%`,
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
              style={
                {
                  left: `${(loc.x / BOARD_COLS) * 100}%`,
                  top: `${(loc.y / BOARD_ROWS) * 100}%`,
                  width: `${100 / BOARD_COLS}%`,
                  height: `${100 / BOARD_ROWS}%`,
                  ["--tile-accent" as string]: loc.accent,
                } as React.CSSProperties
              }
              onClick={() => go(loc.id)}
              disabled={walking}
              title={loc.name}
            >
              {hasJob && <span className="badge">JOB</span>}
              <span className="icon">{loc.icon}</span>
              <span className="tname">{loc.short}</span>
              <span className="tmeta">{here ? "HERE" : `${cost}h`}</span>
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
          🕑 WEEK {state.week} · {state.hours}H LEFT
        </div>
      </div>
    </div>
  );
}

function getLoc(id: LocationId) {
  return LOCATIONS.find((l) => l.id === id)!;
}
