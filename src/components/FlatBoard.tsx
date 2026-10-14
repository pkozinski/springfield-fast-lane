import { useEffect, useRef, useState } from "react";
import { FLANDERS_CELL, LOCATIONS, RING, getJob, ringIndex, ringPath } from "../game/data";
import { travelCost } from "../game/engine";
import { useGame } from "../game/store";
import type { LocationId } from "../game/types";
import Clock from "./Clock";
import { Facade, TownSquare } from "./Facades";
import { Icon } from "./Icon";
import { Portrait, RivalPortrait } from "./Portrait";

/*
  The flat, Jones-style board: storefront tiles around a 5 x 4 ring with the town
  square in the middle. Tokens walk a path just inside the ring, one tile per step.
*/

const COLS = 5;
const ROWS = 4;
const STEP_MS = 230;
/** how far inside the ring the walkway sits, in tile units */
const INSET = 0.16;

type Pt = { x: number; y: number };

/** Where a token stands for a ring cell: on the walkway, on the square side of the tile. */
function spot(c: Pt): Pt {
  let x = c.x + 0.5;
  let y = c.y + 0.5;
  if (c.x === 0) x = 1 + INSET;
  if (c.x === COLS - 1) x = COLS - 1 - INSET;
  if (c.y === 0) y = 1 + INSET;
  if (c.y === ROWS - 1) y = ROWS - 1 - INSET;
  return { x, y };
}

/** Position inside .board-flat, whose 8px padding surrounds the grid. */
const pct = (p: Pt) => ({
  left: `calc(8px + (100% - 16px) * ${p.x / COLS})`,
  top: `calc(8px + (100% - 16px) * ${p.y / ROWS})`,
});

export default function FlatBoard({ onEnter }: { onEnter: (id: LocationId) => void }) {
  const { state, dispatch } = useGame();
  const [pos, setPos] = useState<Pt>(() => spot(RING[Math.max(0, ringIndex(state.location))]));
  const [step, setStep] = useState(0); // bumps on every hop to replay the hop animation
  const [walking, setWalking] = useState(false);
  const [hover, setHover] = useState<LocationId | null>(null);
  const timers = useRef<number[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // snap to the player's location when it changes outside a walk (e.g. week rollover)
  useEffect(() => {
    if (!walking) setPos(spot(RING[Math.max(0, ringIndex(state.location))]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.location]);

  function go(id: LocationId) {
    const s = stateRef.current;
    if (walking) return;
    if (id === s.location) return onEnter(id);
    if (travelCost(s, id) > s.hours) {
      dispatch({ type: "MOVE", to: id }); // the engine explains why you can't
      return;
    }
    const path = ringPath(s.location, id);
    setWalking(true);
    setHover(null);
    path.forEach((c, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setPos(spot(c));
          setStep((n) => n + 1);
        }, i * STEP_MS),
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        setWalking(false);
        dispatch({ type: "MOVE", to: id });
        onEnter(id);
      }, path.length * STEP_MS + 120),
    );
  }

  const jobAt = state.jobId ? getJob(state.jobId).locationId : null;

  // Ned: at his ring cell, stepping aside along the walkway if you share a spot
  const nedCell = RING[state.rival?.cell ?? FLANDERS_CELL];
  const ned = spot(nedCell);
  const meCell = RING[Math.max(0, ringIndex(state.location))];
  if (!walking && nedCell.x === meCell.x && nedCell.y === meCell.y) {
    if (nedCell.y === 0 || nedCell.y === ROWS - 1) ned.x += 0.32;
    else ned.y += 0.32;
  }

  return (
    <div className="board board-flat" data-tut="board">
      <div className="flat-grid">
        {LOCATIONS.map((loc) => {
          const here = loc.id === state.location;
          const cost = travelCost(state, loc.id);
          return (
            <button
              key={loc.id}
              className={"tile" + (here ? " here" : "") + (hover === loc.id ? " hot" : "")}
              style={{ gridColumn: loc.x + 1, gridRow: loc.y + 1, ["--accent" as string]: loc.accent }}
              onClick={() => go(loc.id)}
              onPointerEnter={() => !walking && setHover(loc.id)}
              onPointerLeave={() => setHover((h) => (h === loc.id ? null : h))}
              disabled={walking}
              title={loc.name}
            >
              <Facade id={loc.id} />
              <span className="tile-name">{loc.short}</span>
              {jobAt === loc.id && (
                <span className="tile-job" title="Your workplace">
                  <Icon name="briefcase" size={14} />
                </span>
              )}
              {hover === loc.id && !here && <span className="tile-cost">{cost}h walk</span>}
            </button>
          );
        })}
        <div className="tile tile-static" style={{ gridColumn: 1, gridRow: 2 }} title="The Flanders house">
          <Facade id="flanders" />
          <span className="tile-name">Flanders</span>
        </div>

        <div className="flat-square" style={{ gridColumn: "2 / 5", gridRow: "2 / 4" }}>
          <TownSquare />
          <div className="square-clock">
            <Clock hours={state.hours} total={state.hoursPerWeek} size={64} />
            <div className="clock-meta">
              <span className="wp-week">Week {state.week}</span>
              <span className="wp-hours">
                {state.hours}h of {state.hoursPerWeek}h left
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* tokens ride above the tiles */}
      <div className="flat-token ned" style={pct(ned)} title="Ned Flanders">
        <RivalPortrait size={40} />
      </div>
      <div className={"flat-token me" + (walking ? " walking" : "")} style={pct(pos)} title={state.playerName}>
        <div key={step} className="hop">
          <Portrait id={state.avatar} size={46} />
        </div>
      </div>
    </div>
  );
}
