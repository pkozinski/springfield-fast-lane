import { Suspense, lazy, useState } from "react";
import { useGame } from "../game/store";
import type { LocationId } from "../game/types";
import Clock from "./Clock";
import FlatBoard from "./FlatBoard";

// the 3D board pulls in Three.js, so only load it when someone switches to it
const CityMap = lazy(() => import("./CityMap"));

type Style = "flat" | "3d";
const KEY = "springfield.boardStyle";

function savedStyle(): Style {
  try {
    return localStorage.getItem(KEY) === "3d" ? "3d" : "flat";
  } catch {
    return "flat";
  }
}

/** The board card: header, 2D/3D switch, and whichever board is selected. */
export default function Board({ onEnter, paused }: { onEnter: (id: LocationId) => void; paused: boolean }) {
  const { state } = useGame();
  const [style, setStyle] = useState<Style>(savedStyle);

  const pick = (s: Style) => {
    setStyle(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* private mode: just don't remember */
    }
  };

  return (
    <div className="card stage board-card">
      <div className="map-head">
        <div>
          <h2>Springfield</h2>
          <p>Pick a spot. You walk the board, then head inside.</p>
        </div>
        <div className="map-tools">
          <div className="seg" role="group" aria-label="Board style">
            <button className={style === "flat" ? "on" : ""} onClick={() => pick("flat")}>2D</button>
            <button className={style === "3d" ? "on" : ""} onClick={() => pick("3d")}>3D</button>
          </div>
          <span className="tag">{state.hours}h left</span>
        </div>
      </div>

      {style === "flat" ? (
        <FlatBoard onEnter={onEnter} />
      ) : (
        <div className="board board-3d" data-tut="board">
          <Suspense fallback={null}>
            <CityMap onEnter={onEnter} paused={paused} />
          </Suspense>
          <div className="clock-plate">
            <Clock hours={state.hours} total={state.hoursPerWeek} size={58} />
            <div className="clock-meta">
              <span className="wp-week">Week {state.week}</span>
              <span className="wp-hours">
                {state.hours}h of {state.hoursPerWeek}h left
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
