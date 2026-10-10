import { LOCATIONS, getHome, getJob } from "../game/data";
import { travelCost } from "../game/engine";
import { useGame } from "../game/store";
import type { LocationId } from "../game/types";

export default function CityMap({ onEnter }: { onEnter: (id: LocationId) => void }) {
  const { state, dispatch } = useGame();
  const job = state.jobId ? getJob(state.jobId) : null;
  const home = getHome(state.homeId);

  function go(id: LocationId) {
    if (id !== state.location) dispatch({ type: "MOVE", to: id });
    onEnter(id);
  }

  return (
    <div className="card stage">
      <div className="map-head">
        <div>
          <h2>City Map</h2>
          <p>Travel costs time. Pick where to spend your week.</p>
        </div>
        <span className="tag">{state.hours}h left</span>
      </div>

      <div className="map">
        {LOCATIONS.map((loc) => {
          const here = loc.id === state.location;
          const cost = travelCost(state, loc.id);
          const hasJobHere = job?.locationId === loc.id;
          const isHome = loc.id === "home";
          return (
            <button
              key={loc.id}
              className={"tile" + (here ? " here" : "")}
              style={{ ["--tile-accent" as string]: loc.accent }}
              onClick={() => go(loc.id)}
            >
              {here && <span className="badge">You're here</span>}
              {!here && hasJobHere && <span className="badge">Your job</span>}
              <span className="icon">{loc.icon}</span>
              <span className="tname">{loc.name}</span>
              <span className="tmeta">
                {here
                  ? "Tap to enter"
                  : cost === 0
                  ? "Here"
                  : `${cost}h travel`}
                {isHome ? ` · ${home.name}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
